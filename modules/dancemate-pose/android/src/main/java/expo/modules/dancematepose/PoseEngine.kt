package expo.modules.dancematepose

import android.content.Context
import android.util.Log
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import java.nio.ByteBuffer
import java.nio.ByteOrder

internal const val TAG = "DanceMatePose"
internal const val NUM_LANDMARKS = 33

/** Bundled MediaPipe models. FULL is fast enough for live camera; HEAVY is the most accurate. */
internal enum class PoseModel(val assetName: String) {
  FULL("pose_landmarker_full.task"),
  HEAVY("pose_landmarker_heavy.task");

  companion object {
    fun from(name: String?, fallback: PoseModel): PoseModel = when (name?.lowercase()) {
      "full" -> FULL
      "heavy" -> HEAVY
      else -> fallback
    }
  }
}

internal class LandmarkerHandle(
  val landmarker: PoseLandmarker,
  val delegate: Delegate,
  val model: PoseModel,
) {
  private var closed = false

  @Synchronized
  fun close() {
    if (closed) return
    closed = true
    try {
      landmarker.close()
    } catch (t: Throwable) {
      Log.w(TAG, "Failed to close landmarker", t)
    }
  }
}

internal object PoseEngine {
  private val modelCache = HashMap<PoseModel, ByteBuffer>()

  /**
   * Loads the model into a direct buffer once and keeps it alive for the app's lifetime.
   * Loading from a buffer works whether or not the asset was compressed in the APK.
   */
  @Synchronized
  private fun modelBuffer(context: Context, model: PoseModel): ByteBuffer {
    modelCache[model]?.let { return it.duplicate() }
    val bytes = context.assets.open(model.assetName).use { it.readBytes() }
    val buffer = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder())
    buffer.put(bytes)
    buffer.rewind()
    modelCache[model] = buffer
    return buffer.duplicate()
  }

  /**
   * Creates a pose landmarker, preferring the GPU and falling back to the CPU when the
   * device's GPU delegate is not available.
   */
  fun create(
    context: Context,
    model: PoseModel,
    mode: RunningMode,
    numPoses: Int,
    minConfidence: Float,
    preferGpu: Boolean = true,
  ): LandmarkerHandle {
    val delegates = if (preferGpu) listOf(Delegate.GPU, Delegate.CPU) else listOf(Delegate.CPU)
    var lastError: Throwable? = null
    for (delegate in delegates) {
      try {
        val baseOptions = BaseOptions.builder()
          .setModelAssetBuffer(modelBuffer(context, model))
          .setDelegate(delegate)
          .build()
        val options = PoseLandmarker.PoseLandmarkerOptions.builder()
          .setBaseOptions(baseOptions)
          .setRunningMode(mode)
          .setNumPoses(numPoses.coerceIn(1, 6))
          .setMinPoseDetectionConfidence(minConfidence)
          .setMinPosePresenceConfidence(minConfidence)
          .setMinTrackingConfidence(minConfidence)
          .setOutputSegmentationMasks(false)
          .build()
        val landmarker = PoseLandmarker.createFromOptions(context, options)
        Log.i(TAG, "Pose landmarker ready: model=$model delegate=$delegate mode=$mode")
        return LandmarkerHandle(landmarker, delegate, model)
      } catch (t: Throwable) {
        Log.w(TAG, "Pose landmarker init failed with $delegate", t)
        lastError = t
      }
    }
    throw IllegalStateException("Could not start the pose detector: ${lastError?.message}", lastError)
  }

  /** Visibility of a landmark: the model's visibility score, capped by its presence score. */
  fun visibilityOf(lm: NormalizedLandmark): Float {
    val vis = lm.visibility().orElse(1f)
    val presence = lm.presence().orElse(1f)
    return minOf(vis, presence)
  }

  /** Rounds to 4 decimals to keep stored pose data compact (0.1 pixel precision on a 1000px frame). */
  fun round4(v: Float): Double = Math.round(v * 10000.0) / 10000.0
}
