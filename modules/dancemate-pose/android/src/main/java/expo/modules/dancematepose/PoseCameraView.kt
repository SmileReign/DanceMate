package expo.modules.dancematepose

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.util.Size
import android.view.Surface
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.util.ArrayDeque
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Live camera with on-device MediaPipe pose tracking, drawn frame-synchronized.
 *
 * Per camera frame (background thread):
 *   upright RGBA frame (rotated by CameraX) -> MediaPipe on the GPU -> 33 landmarks
 * then on the UI thread the *same* frame and its landmarks are drawn together, so the
 * skeleton is always exactly on the body in every frame shown.
 *
 * Only the newest camera frame is processed, so there is never a backlog.
 */
@SuppressLint("ViewConstructor")
class PoseCameraView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true

  // Coalesced: if JS is busy, it only receives the newest pose, never a queue of stale ones.
  private val onPose by EventDispatcher<Map<String, Any?>> { _ -> 0 }
  private val onTrackerStatus by EventDispatcher<Map<String, Any?>>()

  private val poseView = SyncedPoseView(context)

  private val mainHandler = Handler(Looper.getMainLooper())
  private val analysisExecutor: ExecutorService = Executors.newSingleThreadExecutor()

  // Props
  private var facing = "front"
  private var active = true
  private var mirrorFront = true
  private var emitLandmarks = true

  // Camera state (UI thread)
  private var cameraProvider: ProcessCameraProvider? = null
  private var imageAnalysis: ImageAnalysis? = null
  private var bindGeneration = 0
  private var isFrontBound = true
  private var isBound = false
  private var bindAttempts = 0
  // Last time a camera frame was shown (UI thread), for the stall watchdog.
  private var lastPresentedAt = 0L
  private var gotFirstFrame = false
  @Volatile private var released = false

  // Analysis state (analysis thread only)
  private var landmarker: LandmarkerHandle? = null
  private var landmarkerModel: PoseModel? = null
  private var landmarkerFailed = false
  private var lastTimestampMs = 0L
  private var scratchBitmap: Bitmap? = null
  private val rotatePaint = Paint(Paint.FILTER_BITMAP_FLAG)
  @Volatile private var requestedModel = PoseModel.FULL

  // Frame pool shared by the analysis thread (takes) and the UI thread (returns).
  private val pool = ArrayDeque<Bitmap>()
  private var poolAllocated = 0

  // Stats
  private var lastFrameAt = 0L
  private var fps = 0.0

  init {
    addView(poseView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    poseView.onFrameRecycled = { bmp -> recycleFrame(bmp) }
    applyMirror()
  }

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  fun setFacing(value: String?) {
    val next = if (value == "back") "back" else "front"
    if (next == facing) return
    facing = next
    poseView.clear()
    applyMirror()
    rebind()
  }

  fun setActive(value: Boolean) {
    if (value == active) return
    active = value
    if (active) rebind() else stopCamera()
  }

  fun setMirror(value: Boolean) {
    mirrorFront = value
    applyMirror()
  }

  fun setEmitLandmarks(value: Boolean) {
    emitLandmarks = value
  }

  fun setModel(value: String?) {
    requestedModel = PoseModel.from(value, PoseModel.FULL)
  }

  fun setShowSkeleton(value: Boolean) {
    poseView.showSkeleton = value
  }

  fun setSkeletonColor(value: String?) {
    poseView.boneColor = SyncedPoseView.parseColor(value, poseView.boneColor)
  }

  fun setJointColor(value: String?) {
    poseView.jointColor = SyncedPoseView.parseColor(value, poseView.jointColor)
  }

  fun setStrokeWidth(value: Double) {
    poseView.strokeWidthDp = value.toFloat()
  }

  fun setHighlightJoints(value: List<Int>?) {
    poseView.highlight = value?.toSet() ?: emptySet()
  }

  fun setFrameOpacity(value: Double) {
    poseView.frameAlpha = (value.coerceIn(0.0, 1.0) * 255).toInt()
  }

  /** The front camera is shown like a mirror unless mirroring is turned off. */
  private fun applyMirror() {
    poseView.mirror = facing == "front" && mirrorFront
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    liveViews.remove(this)
    liveViews.add(this)
    if (active) rebind()
    startWatchdog()
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    liveViews.remove(this)
    stopCamera()
    mainHandler.removeCallbacks(watchdog)
    handCameraToNextView()
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    // Keep frames upright when the phone rotates.
    imageAnalysis?.targetRotation = poseView.display?.rotation ?: Surface.ROTATION_0
  }

  fun release() {
    released = true
    liveViews.remove(this)
    mainHandler.removeCallbacks(watchdog)
    stopCamera()
    handCameraToNextView()
    analysisExecutor.execute {
      landmarker?.close()
      landmarker = null
      scratchBitmap = null
      synchronized(pool) { pool.clear() }
    }
    analysisExecutor.shutdown()
  }

  /**
   * Only one camera view can own the camera. When the owner goes away (view mode change,
   * screen change), the newest remaining view on screen takes the camera back.
   */
  private fun handCameraToNextView() {
    val next = liveViews.lastOrNull { it !== this && !it.released && it.active && it.isAttachedToWindow }
    if (next != null && !next.isBound) mainHandler.post { next.rebind() }
  }

  // Restarts the camera if no frame has been shown for a while (e.g. the camera was taken
  // by another view, or a buffer got lost). Keeps the picture from freezing.
  private val watchdog = object : Runnable {
    override fun run() {
      if (released || !isAttachedToWindow) return
      val now = SystemClock.uptimeMillis()
      val resumed = (appContext.currentActivity as? LifecycleOwner)
        ?.lifecycle?.currentState?.isAtLeast(Lifecycle.State.RESUMED) == true
      if (!resumed) lastPresentedAt = now // app in background: frames are paused on purpose
      // The first frame can take longer (the pose model loads on first use).
      val limit = if (gotFirstFrame) STALL_MS else FIRST_FRAME_MS
      if (active && isBound && resumed && lastPresentedAt > 0 && now - lastPresentedAt > limit) {
        Log.w(TAG, "Camera feed stalled, restarting")
        lastPresentedAt = now
        rebind()
      }
      mainHandler.postDelayed(this, STALL_MS / 2)
    }
  }

  private fun startWatchdog() {
    mainHandler.removeCallbacks(watchdog)
    mainHandler.postDelayed(watchdog, STALL_MS)
  }

  private fun emitStatus(status: String, message: String? = null, delegate: String? = null) {
    mainHandler.post {
      onTrackerStatus(mapOf("status" to status, "message" to message, "delegate" to delegate))
    }
  }

  // ---------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------

  private fun rebind() {
    if (released || !active || !isAttachedToWindow) return
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      emitStatus("error", "Camera permission has not been granted")
      return
    }
    val owner = appContext.currentActivity as? LifecycleOwner
    if (owner == null) {
      emitStatus("error", "Camera is not available right now")
      return
    }
    val generation = ++bindGeneration
    // Fresh frame pool for every camera session, so a lost buffer can never stall the feed.
    synchronized(pool) {
      pool.clear()
      poolAllocated = 0
    }
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
      if (generation != bindGeneration || released || !active) return@addListener
      try {
        val provider = future.get()
        cameraProvider = provider
        bindAnalysis(provider, owner)
      } catch (t: Throwable) {
        Log.e(TAG, "Camera provider failed", t)
        emitStatus("error", "Could not open the camera: ${t.message}")
      }
    }, ContextCompat.getMainExecutor(context))
  }

  private fun bindAnalysis(provider: ProcessCameraProvider, owner: LifecycleOwner) {
    unbindOwnUseCases()
    // Take the camera from any other camera view (two at once makes the camera fail or freeze).
    for (other in liveViews) {
      if (other !== this) other.unbindOwnUseCases()
    }

    // 960x720 (4:3): fills a phone screen and keeps per-frame copying light for smooth 30fps.
    val selector = ResolutionSelector.Builder()
      .setAspectRatioStrategy(AspectRatioStrategy.RATIO_4_3_FALLBACK_AUTO_STRATEGY)
      .setResolutionStrategy(
        ResolutionStrategy(Size(960, 720), ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER)
      )
      .build()

    val analysis = ImageAnalysis.Builder()
      .setResolutionSelector(selector)
      .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
      .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
      // CameraX rotates frames upright with fast native code.
      .setOutputImageRotationEnabled(true)
      .setTargetRotation(poseView.display?.rotation ?: Surface.ROTATION_0)
      .build()
    analysis.setAnalyzer(analysisExecutor) { image -> analyzeFrame(image) }

    val wantFront = facing != "back"
    val primary = if (wantFront) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
    val secondary = if (wantFront) CameraSelector.DEFAULT_BACK_CAMERA else CameraSelector.DEFAULT_FRONT_CAMERA

    try {
      // Only use the other camera if this phone has no such camera. A camera that is just busy
      // (still closing from the previous screen) is retried instead of silently switching.
      val hasPrimary = try { provider.hasCamera(primary) } catch (t: Throwable) { true }
      isFrontBound = if (hasPrimary) wantFront else !wantFront
      provider.bindToLifecycle(owner, if (hasPrimary) primary else secondary, analysis)
      imageAnalysis = analysis
      isBound = true
      bindAttempts = 0
      lastFrameAt = 0L
      lastPresentedAt = SystemClock.uptimeMillis()
      gotFirstFrame = false
      emitStatus("camera-ready")
    } catch (t: Throwable) {
      Log.e(TAG, "Failed to bind camera", t)
      analysis.clearAnalyzer()
      // The camera may still be closing from the previous screen: try again shortly.
      if (bindAttempts < MAX_BIND_ATTEMPTS) {
        bindAttempts++
        val generation = bindGeneration
        mainHandler.postDelayed({ if (generation == bindGeneration) rebind() }, 400L * bindAttempts)
      } else {
        emitStatus("error", "Could not start the camera: ${t.message}")
      }
    }
  }

  private fun unbindOwnUseCases() {
    isBound = false
    val provider = cameraProvider ?: return
    val analysis = imageAnalysis ?: return
    analysis.clearAnalyzer()
    try {
      provider.unbind(analysis)
    } catch (t: Throwable) {
      Log.w(TAG, "Unbind failed", t)
    }
    imageAnalysis = null
  }

  private fun stopCamera() {
    bindGeneration++
    unbindOwnUseCases()
    poseView.clear()
  }

  // ---------------------------------------------------------------------------
  // Frame pool
  // ---------------------------------------------------------------------------

  private fun obtainFrame(w: Int, h: Int): Bitmap? {
    synchronized(pool) {
      while (pool.isNotEmpty()) {
        val b = pool.poll()!!
        if (b.width == w && b.height == h && !b.isRecycled) return b
        poolAllocated--
      }
      // Frames in use: analysing, waiting to show, on screen, and the one before it.
      if (poolAllocated >= MAX_POOL) return null
      poolAllocated++
    }
    return Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
  }

  private fun recycleFrame(bitmap: Bitmap) {
    synchronized(pool) { pool.add(bitmap) }
  }

  // ---------------------------------------------------------------------------
  // Pose analysis (analysis thread)
  // ---------------------------------------------------------------------------

  private fun ensureLandmarker(): LandmarkerHandle? {
    val wanted = requestedModel
    val current = landmarker
    if (current != null && landmarkerModel == wanted) return current
    if (landmarkerFailed && landmarkerModel == wanted) return null
    current?.close()
    landmarker = null
    landmarkerModel = wanted
    return try {
      val handle = PoseEngine.create(context, wanted, RunningMode.VIDEO, numPoses = 1, minConfidence = 0.5f)
      landmarker = handle
      landmarkerFailed = false
      lastTimestampMs = 0L
      emitStatus("tracker-ready", null, handle.delegate.name)
      handle
    } catch (t: Throwable) {
      landmarkerFailed = true
      emitStatus("error", t.message)
      null
    }
  }

  private fun analyzeFrame(image: ImageProxy) {
    if (released) {
      image.close()
      return
    }
    val handle = ensureLandmarker()
    val rotation = image.imageInfo.rotationDegrees
    val swap = rotation == 90 || rotation == 270
    val outW = if (swap) image.height else image.width
    val outH = if (swap) image.width else image.height

    // 1. Copy the upright frame into a pooled bitmap and give the camera buffer straight back.
    val frame = obtainFrame(outW, outH)
    if (frame == null) {
      image.close() // screen is behind; drop this frame rather than add delay
      return
    }
    val ok = try {
      copyUpright(image, rotation, frame)
      true
    } catch (t: Throwable) {
      Log.w(TAG, "Frame conversion failed", t)
      false
    } finally {
      image.close()
    }
    if (!ok) {
      recycleFrame(frame)
      return
    }

    // 2. Run MediaPipe on exactly this frame.
    var pose: List<com.google.mediapipe.tasks.components.containers.NormalizedLandmark>? = null
    var worldPose: List<com.google.mediapipe.tasks.components.containers.Landmark>? = null
    var inferenceMs = 0.0
    if (handle != null) {
      var ts = SystemClock.uptimeMillis()
      if (ts <= lastTimestampMs) ts = lastTimestampMs + 1
      lastTimestampMs = ts
      val started = SystemClock.elapsedRealtimeNanos()
      val result = try {
        handle.landmarker.detectForVideo(BitmapImageBuilder(frame).build(), ts)
      } catch (t: Throwable) {
        Log.w(TAG, "Detection failed on ${handle.delegate}", t)
        if (handle.delegate == Delegate.GPU) rebuildOnCpu(handle)
        null
      }
      inferenceMs = (SystemClock.elapsedRealtimeNanos() - started) / 1_000_000.0
      pose = result?.landmarks()?.firstOrNull()?.takeIf { it.size >= NUM_LANDMARKS }
      worldPose = result?.worldLandmarks()?.firstOrNull()
    }

    val norm: FloatArray?
    val vis: FloatArray?
    val z: FloatArray?
    if (pose != null) {
      val n = FloatArray(NUM_LANDMARKS * 2)
      val v = FloatArray(NUM_LANDMARKS)
      val zz = FloatArray(NUM_LANDMARKS)
      for (i in 0 until NUM_LANDMARKS) {
        val lm = pose[i]
        n[i * 2] = lm.x()
        n[i * 2 + 1] = lm.y()
        v[i] = PoseEngine.visibilityOf(lm)
        zz[i] = lm.z()
      }
      norm = n; vis = v; z = zz
    } else {
      norm = null; vis = null; z = null
    }
    val world: FloatArray? = if (pose != null && worldPose != null) {
      FloatArray(NUM_LANDMARKS * 3).also { arr ->
        for (i in 0 until minOf(NUM_LANDMARKS, worldPose.size)) {
          arr[i * 3] = worldPose[i].x(); arr[i * 3 + 1] = worldPose[i].y(); arr[i * 3 + 2] = worldPose[i].z()
        }
      }
    } else null

    val now = SystemClock.uptimeMillis()
    if (lastFrameAt > 0) {
      val instant = 1000.0 / maxOf(1L, now - lastFrameAt)
      fps = if (fps == 0.0) instant else fps * 0.85 + instant * 0.15
    }
    lastFrameAt = now

    // 3. Present the frame and its skeleton together.
    val delegate = handle?.delegate
    val frameFps = fps
    mainHandler.post {
      if (released || !active) {
        recycleFrame(frame)
        return@post
      }
      poseView.present(frame, norm, vis)
      lastPresentedAt = SystemClock.uptimeMillis()
      gotFirstFrame = true
      if (emitLandmarks) emitPose(norm, vis, z, world, inferenceMs, frameFps, delegate)
    }
  }

  private fun rebuildOnCpu(failed: LandmarkerHandle) {
    // Some GPUs only fail at inference time; continue on the CPU.
    failed.close()
    landmarker = try {
      PoseEngine.create(context, failed.model, RunningMode.VIDEO, 1, 0.5f, preferGpu = false).also {
        lastTimestampMs = 0L
        emitStatus("tracker-ready", null, it.delegate.name)
      }
    } catch (e: Throwable) {
      landmarkerFailed = true
      emitStatus("error", e.message)
      null
    }
  }

  /** Copies an RGBA ImageProxy into [out], rotating it upright if CameraX has not already. */
  private fun copyUpright(image: ImageProxy, rotation: Int, out: Bitmap) {
    val plane = image.planes[0]
    val w = image.width
    val h = image.height
    val tightlyPacked = plane.pixelStride == 4 && plane.rowStride == w * 4

    if (rotation == 0 && tightlyPacked) {
      val buffer = plane.buffer
      buffer.rewind()
      out.copyPixelsFromBuffer(buffer)
      return
    }

    // Slower path: padded rows or a frame that still needs rotating.
    val src: Bitmap = if (tightlyPacked) {
      var s = scratchBitmap
      if (s == null || s.width != w || s.height != h) {
        s = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        scratchBitmap = s
      }
      val buffer = plane.buffer
      buffer.rewind()
      s!!.copyPixelsFromBuffer(buffer)
      s
    } else {
      image.toBitmap()
    }
    val m = Matrix()
    bufferToUprightMatrix(rotation, w, h, m)
    Canvas(out).drawBitmap(src, m, rotatePaint)
  }

  // ---------------------------------------------------------------------------
  // JS events (UI thread)
  // ---------------------------------------------------------------------------

  private fun emitPose(
    norm: FloatArray?,
    vis: FloatArray?,
    z: FloatArray?,
    world: FloatArray?,
    inferenceMs: Double,
    frameFps: Double,
    delegate: Delegate?,
  ) {
    val viewPts = if (norm != null) poseView.toViewNormalized(norm) else null
    if (viewPts == null || vis == null) {
      onPose(
        mapOf(
          "landmarks" to emptyList<Double>(),
          "fps" to frameFps,
          "inferenceMs" to inferenceMs,
          "delegate" to delegate?.name,
        )
      )
      return
    }
    val flat = ArrayList<Double>(NUM_LANDMARKS * 4)
    for (i in 0 until NUM_LANDMARKS) {
      flat.add(PoseEngine.round4(viewPts[i * 2]))
      flat.add(PoseEngine.round4(viewPts[i * 2 + 1]))
      flat.add(PoseEngine.round4(z?.get(i) ?: 0f))
      flat.add(PoseEngine.round4(vis[i]))
    }
    onPose(
      mapOf(
        "landmarks" to flat,
        "worldLandmarks" to world?.map { PoseEngine.round4(it) },
        "fps" to frameFps,
        "inferenceMs" to inferenceMs,
        "delegate" to delegate?.name,
        "isFrontCamera" to isFrontBound,
      )
    )
  }

  companion object {
    private const val MAX_POOL = 5
    private const val STALL_MS = 2500L
    private const val FIRST_FRAME_MS = 6000L
    private const val MAX_BIND_ATTEMPTS = 4

    /** Camera views currently on screen, oldest first (UI thread only). */
    private val liveViews = LinkedHashSet<PoseCameraView>()

    /** Matrix that rotates a bufferW x bufferH image clockwise by [rotation] into an upright image. */
    fun bufferToUprightMatrix(rotation: Int, bufferW: Int, bufferH: Int, out: Matrix) {
      out.reset()
      when (rotation) {
        90 -> { out.postRotate(90f); out.postTranslate(bufferH.toFloat(), 0f) }
        180 -> { out.postRotate(180f); out.postTranslate(bufferW.toFloat(), bufferH.toFloat()) }
        270 -> { out.postRotate(270f); out.postTranslate(0f, bufferW.toFloat()) }
      }
    }
  }
}
