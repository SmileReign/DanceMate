package expo.modules.dancematepose

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Rect
import android.media.Image
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.SystemClock
import android.util.Log
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

internal data class VideoInfo(
  val width: Int, // upright (display) width
  val height: Int, // upright (display) height
  val rotation: Int,
  val durationMs: Long,
)

internal data class AnalyzeOptions(
  val startMs: Long,
  val endMs: Long, // <= 0 means "to the end"
  val fps: Double,
  val numPoses: Int,
  val model: PoseModel,
  val maxDimension: Int,
)

/**
 * Tracks every frame of an uploaded video, in order, with no frames skipped because of
 * playback speed. Frames are decoded with the hardware video decoder, so this is far
 * faster than seeking to each timestamp.
 */
internal class VideoPoseAnalyzer(private val context: Context) {
  @Volatile var cancelled = false
  private var detectionFailed = false

  private val rotatePaint = Paint(Paint.FILTER_BITMAP_FLAG)
  private var pixelBuffer = IntArray(0)
  private var yBytes = ByteArray(0)
  private var uBytes = ByteArray(0)
  private var vBytes = ByteArray(0)
  private var frameBitmap: Bitmap? = null
  private var uprightBitmap: Bitmap? = null

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  fun readInfo(uri: String): VideoInfo {
    val retriever = MediaMetadataRetriever()
    try {
      setRetrieverSource(retriever, uri)
      val w = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
      val h = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
      val rot = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
      val dur = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
      val normRot = ((rot % 360) + 360) % 360
      val swap = normRot == 90 || normRot == 270
      return VideoInfo(
        width = if (swap) h else w,
        height = if (swap) w else h,
        rotation = normRot,
        durationMs = dur,
      )
    } finally {
      try { retriever.release() } catch (_: Throwable) {}
    }
  }

  /** Detects all people in one frame (used to let the user pick which dancer to track). */
  fun detectSingleFrame(uri: String, timeMs: Long, numPoses: Int, maxDimension: Int): Map<String, Any?> {
    val info = readInfo(uri)
    val retriever = MediaMetadataRetriever()
    val bitmap: Bitmap
    try {
      setRetrieverSource(retriever, uri)
      val frame = retriever.getFrameAtTime(timeMs * 1000, MediaMetadataRetriever.OPTION_CLOSEST)
        ?: retriever.getFrameAtTime(timeMs * 1000, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
        ?: throw IllegalStateException("Could not read a frame from this video")
      bitmap = ensureUpright(scaleDown(frame, maxDimension), info)
    } finally {
      try { retriever.release() } catch (_: Throwable) {}
    }

    val handle = PoseEngine.create(context, PoseModel.HEAVY, RunningMode.IMAGE, numPoses, 0.4f)
    try {
      val result = handle.landmarker.detect(BitmapImageBuilder(bitmap).build())
      return mapOf(
        "width" to info.width,
        "height" to info.height,
        "durationMs" to info.durationMs.toDouble(),
        "delegate" to handle.delegate.name,
        "poses" to serializePoses(result),
      )
    } finally {
      handle.close()
    }
  }

  fun analyze(
    uri: String,
    options: AnalyzeOptions,
    onProgress: (progress: Double, processed: Int, timeMs: Double, posesInFrame: Int) -> Unit,
  ): Map<String, Any?> {
    val info = readInfo(uri)
    // Unknown length: decode until the stream ends (kept small enough to never overflow).
    val durationMs = if (info.durationMs > 0) info.durationMs else 24L * 60 * 60 * 1000
    val startUs = max(0L, options.startMs) * 1000
    val endUs = if (options.endMs > options.startMs) min(options.endMs, durationMs) * 1000 else durationMs * 1000
    val fps = options.fps.coerceIn(5.0, 60.0)

    val handle = PoseEngine.create(context, options.model, RunningMode.VIDEO, options.numPoses, 0.4f)
    var usedDelegate = handle.delegate.name
    val frames = ArrayList<Map<String, Any?>>()
    val started = SystemClock.elapsedRealtime()
    var decoder = "hardware"
    detectionFailed = false
    try {
      try {
        decodeWithMediaCodec(uri, info, options, startUs, endUs, fps, handle, frames, onProgress)
      } catch (t: Throwable) {
        if (cancelled) throw t
        frames.clear()
        handle.close()
        if (detectionFailed) {
          // The GPU failed while running the model: keep the fast decoder, run the model on the CPU.
          Log.w(TAG, "Pose model failed on ${handle.delegate}, retrying on CPU", t)
          detectionFailed = false
          val cpu = PoseEngine.create(context, options.model, RunningMode.VIDEO, options.numPoses, 0.4f, preferGpu = false)
          usedDelegate = cpu.delegate.name
          try {
            decodeWithMediaCodec(uri, info, options, startUs, endUs, fps, cpu, frames, onProgress)
          } finally {
            cpu.close()
          }
        } else {
          // Some devices/codecs can't hand out decoded frames; fall back to frame-by-frame seeking.
          Log.w(TAG, "Hardware decode path failed, using frame retriever", t)
          decoder = "retriever"
          val fallback = PoseEngine.create(context, options.model, RunningMode.VIDEO, options.numPoses, 0.4f)
          usedDelegate = fallback.delegate.name
          try {
            decodeWithRetriever(uri, info, options, startUs, endUs, fps, fallback, frames, onProgress)
          } finally {
            fallback.close()
          }
        }
      }
    } finally {
      handle.close()
    }

    return mapOf(
      "width" to info.width,
      "height" to info.height,
      "durationMs" to info.durationMs.toDouble(),
      "delegate" to usedDelegate,
      "decoder" to decoder,
      "elapsedMs" to (SystemClock.elapsedRealtime() - started).toDouble(),
      "cancelled" to cancelled,
      "frames" to frames,
    )
  }

  // ---------------------------------------------------------------------------
  // Hardware decoding path
  // ---------------------------------------------------------------------------

  private fun decodeWithMediaCodec(
    uri: String,
    info: VideoInfo,
    options: AnalyzeOptions,
    startUs: Long,
    endUs: Long,
    fps: Double,
    handle: LandmarkerHandle,
    frames: ArrayList<Map<String, Any?>>,
    onProgress: (Double, Int, Double, Int) -> Unit,
  ) {
    val extractor = MediaExtractor()
    var codec: MediaCodec? = null
    try {
      setExtractorSource(extractor, uri)
      var trackIndex = -1
      var format: MediaFormat? = null
      for (i in 0 until extractor.trackCount) {
        val f = extractor.getTrackFormat(i)
        if (f.getString(MediaFormat.KEY_MIME)?.startsWith("video/") == true) {
          trackIndex = i
          format = f
          break
        }
      }
      if (trackIndex < 0 || format == null) throw IllegalStateException("No video track found")
      extractor.selectTrack(trackIndex)
      val mime = format.getString(MediaFormat.KEY_MIME)!!
      format.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)

      codec = MediaCodec.createDecoderByType(mime)
      codec.configure(format, null, null, 0)
      codec.start()
      extractor.seekTo(startUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)

      val stepUs = (1_000_000.0 / fps)
      val toleranceUs = stepUs * 0.25
      var nextSampleUs = startUs.toDouble()
      val bufferInfo = MediaCodec.BufferInfo()
      var inputDone = false
      var outputDone = false
      var idleLoops = 0
      var lastTsMs = -1L
      var lastProgressAt = 0L

      while (!outputDone && !cancelled) {
        if (!inputDone) {
          val inIndex = codec.dequeueInputBuffer(10_000)
          if (inIndex >= 0) {
            val inBuf = codec.getInputBuffer(inIndex)!!
            val size = extractor.readSampleData(inBuf, 0)
            val sampleTime = extractor.sampleTime
            if (size < 0 || sampleTime > endUs + 1_000_000) {
              codec.queueInputBuffer(inIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              inputDone = true
            } else {
              codec.queueInputBuffer(inIndex, 0, size, sampleTime, 0)
              extractor.advance()
            }
          }
        }

        val outIndex = codec.dequeueOutputBuffer(bufferInfo, 10_000)
        if (outIndex < 0) {
          if (inputDone && outIndex == MediaCodec.INFO_TRY_AGAIN_LATER && ++idleLoops > 500) break
          continue
        }
        idleLoops = 0
        if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) outputDone = true

        val ptsUs = bufferInfo.presentationTimeUs
        if (ptsUs > endUs + toleranceUs) {
          codec.releaseOutputBuffer(outIndex, false)
          break
        }
        val wanted = bufferInfo.size > 0 &&
          ptsUs + toleranceUs >= startUs &&
          ptsUs + toleranceUs >= nextSampleUs
        if (!wanted) {
          codec.releaseOutputBuffer(outIndex, false)
          continue
        }

        val image = codec.getOutputImage(outIndex)
        val bitmap = if (image != null) {
          try {
            yuvToUprightBitmap(image, info.rotation, options.maxDimension)
          } finally {
            image.close()
          }
        } else null
        codec.releaseOutputBuffer(outIndex, false)
        if (bitmap == null) throw IllegalStateException("Decoder did not provide frame pixels")

        nextSampleUs = max(nextSampleUs + stepUs, ptsUs + stepUs * 0.5)

        var tsMs = ptsUs / 1000
        if (tsMs <= lastTsMs) tsMs = lastTsMs + 1
        lastTsMs = tsMs

        val poses = detectAndRecord(handle, bitmap, tsMs, ptsUs / 1_000_000.0, frames)

        val now = SystemClock.elapsedRealtime()
        if (now - lastProgressAt > 120) {
          lastProgressAt = now
          val progress = ((ptsUs - startUs).toDouble() / max(1L, endUs - startUs)).coerceIn(0.0, 1.0)
          onProgress(progress, frames.size, ptsUs / 1000.0, poses)
        }
      }
      onProgress(1.0, frames.size, endUs / 1000.0, 0)
    } finally {
      try { codec?.stop() } catch (_: Throwable) {}
      try { codec?.release() } catch (_: Throwable) {}
      try { extractor.release() } catch (_: Throwable) {}
    }
  }

  // ---------------------------------------------------------------------------
  // Fallback path: seek to each timestamp
  // ---------------------------------------------------------------------------

  private fun decodeWithRetriever(
    uri: String,
    info: VideoInfo,
    options: AnalyzeOptions,
    startUs: Long,
    endUs: Long,
    fps: Double,
    handle: LandmarkerHandle,
    frames: ArrayList<Map<String, Any?>>,
    onProgress: (Double, Int, Double, Int) -> Unit,
  ) {
    val retriever = MediaMetadataRetriever()
    try {
      setRetrieverSource(retriever, uri)
      val stepUs = 1_000_000.0 / fps
      var t = startUs.toDouble()
      var lastTsMs = -1L
      var lastProgressAt = 0L
      while (t <= endUs && !cancelled) {
        val tUs = t.toLong()
        val frame = retriever.getFrameAtTime(tUs, MediaMetadataRetriever.OPTION_CLOSEST)
        if (frame != null) {
          val bitmap = ensureUpright(scaleDown(frame, options.maxDimension), info)
          var tsMs = tUs / 1000
          if (tsMs <= lastTsMs) tsMs = lastTsMs + 1
          lastTsMs = tsMs
          val poses = detectAndRecord(handle, bitmap, tsMs, tUs / 1_000_000.0, frames)
          val now = SystemClock.elapsedRealtime()
          if (now - lastProgressAt > 120) {
            lastProgressAt = now
            val progress = ((tUs - startUs).toDouble() / max(1L, endUs - startUs)).coerceIn(0.0, 1.0)
            onProgress(progress, frames.size, tUs / 1000.0, poses)
          }
        }
        t += stepUs
      }
      onProgress(1.0, frames.size, endUs / 1000.0, 0)
    } finally {
      try { retriever.release() } catch (_: Throwable) {}
    }
  }

  // ---------------------------------------------------------------------------
  // Detection + serialization
  // ---------------------------------------------------------------------------

  private fun detectAndRecord(
    handle: LandmarkerHandle,
    bitmap: Bitmap,
    tsMs: Long,
    timeSec: Double,
    frames: ArrayList<Map<String, Any?>>,
  ): Int {
    val result = try {
      handle.landmarker.detectForVideo(BitmapImageBuilder(bitmap).build(), tsMs)
    } catch (t: Throwable) {
      detectionFailed = true
      throw t
    }
    val poses = serializePoses(result)
    frames.add(mapOf("t" to timeSec, "poses" to poses))
    return poses.size
  }

  private fun serializePoses(result: PoseLandmarkerResult): List<Map<String, Any?>> {
    val out = ArrayList<Map<String, Any?>>()
    val all = result.landmarks()
    val worldAll = result.worldLandmarks()
    for (p in all.indices) {
      val pose = all[p]
      if (pose.size < NUM_LANDMARKS) continue
      val flat = ArrayList<Double>(NUM_LANDMARKS * 4)
      for (i in 0 until NUM_LANDMARKS) {
        val lm = pose[i]
        flat.add(PoseEngine.round4(lm.x()))
        flat.add(PoseEngine.round4(lm.y()))
        flat.add(PoseEngine.round4(lm.z()))
        flat.add(PoseEngine.round4(PoseEngine.visibilityOf(lm)))
      }
      val world = worldAll.getOrNull(p)?.let { w ->
        val list = ArrayList<Double>(NUM_LANDMARKS * 3)
        for (i in 0 until min(NUM_LANDMARKS, w.size)) {
          list.add(PoseEngine.round4(w[i].x()))
          list.add(PoseEngine.round4(w[i].y()))
          list.add(PoseEngine.round4(w[i].z()))
        }
        list
      }
      out.add(mapOf("landmarks" to flat, "worldLandmarks" to world))
    }
    return out
  }

  // ---------------------------------------------------------------------------
  // Image helpers
  // ---------------------------------------------------------------------------

  /**
   * Converts a decoded YUV frame to an upright RGB bitmap, scaling the long side down to
   * [maxDimension] during the conversion (the model works on a 256px crop of the dancer).
   */
  private fun yuvToUprightBitmap(image: Image, rotation: Int, maxDimension: Int): Bitmap {
    if (image.planes.size < 3) {
      throw IllegalStateException("Unsupported decoder output format ${image.format}")
    }
    val crop: Rect = image.cropRect ?: Rect(0, 0, image.width, image.height)
    val srcW = crop.width()
    val srcH = crop.height()
    val scale = min(1.0, maxDimension.toDouble() / max(srcW, srcH))
    val outW = max(2, (srcW * scale).roundToInt())
    val outH = max(2, (srcH * scale).roundToInt())

    val yPlane = image.planes[0]
    val uPlane = image.planes[1]
    val vPlane = image.planes[2]
    yBytes = copyPlane(yPlane.buffer, yBytes)
    uBytes = copyPlane(uPlane.buffer, uBytes)
    vBytes = copyPlane(vPlane.buffer, vBytes)
    val yRow = yPlane.rowStride
    val yPix = yPlane.pixelStride
    val uRow = uPlane.rowStride
    val uPix = uPlane.pixelStride
    val vRow = vPlane.rowStride
    val vPix = vPlane.pixelStride

    val needed = outW * outH
    if (pixelBuffer.size < needed) pixelBuffer = IntArray(needed)
    val px = pixelBuffer
    val y = yBytes
    val u = uBytes
    val v = vBytes

    for (oy in 0 until outH) {
      val sy = crop.top + (oy * srcH) / outH
      val yOff = sy * yRow
      val cy = sy shr 1
      val uOff = cy * uRow
      val vOff = cy * vRow
      val rowOut = oy * outW
      for (ox in 0 until outW) {
        val sx = crop.left + (ox * srcW) / outW
        val yi = yOff + sx * yPix
        val cx = sx shr 1
        val yy = if (yi < y.size) (y[yi].toInt() and 0xFF) else 0
        val ui = uOff + cx * uPix
        val vi = vOff + cx * vPix
        val uu = (if (ui < u.size) (u[ui].toInt() and 0xFF) else 128) - 128
        val vv = (if (vi < v.size) (v[vi].toInt() and 0xFF) else 128) - 128
        // BT.601 limited range -> RGB (fixed point, x1024)
        val c = 1192 * max(0, yy - 16)
        var r = (c + 1634 * vv) shr 10
        var g = (c - 833 * vv - 400 * uu) shr 10
        var b = (c + 2066 * uu) shr 10
        r = if (r < 0) 0 else if (r > 255) 255 else r
        g = if (g < 0) 0 else if (g > 255) 255 else g
        b = if (b < 0) 0 else if (b > 255) 255 else b
        px[rowOut + ox] = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
      }
    }

    var bmp = frameBitmap
    if (bmp == null || bmp.width != outW || bmp.height != outH) {
      bmp = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)
      frameBitmap = bmp
    }
    bmp!!.setPixels(px, 0, outW, 0, 0, outW, outH)
    return rotateInto(bmp, rotation)
  }

  private fun copyPlane(buffer: java.nio.ByteBuffer, reuse: ByteArray): ByteArray {
    buffer.rewind()
    val size = buffer.remaining()
    val out = if (reuse.size >= size) reuse else ByteArray(size)
    buffer.get(out, 0, size)
    return out
  }

  private fun rotateInto(src: Bitmap, rotation: Int): Bitmap {
    if (rotation == 0) return src
    val swap = rotation == 90 || rotation == 270
    val outW = if (swap) src.height else src.width
    val outH = if (swap) src.width else src.height
    var out = uprightBitmap
    if (out == null || out.width != outW || out.height != outH) {
      out = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)
      uprightBitmap = out
    }
    val m = Matrix()
    PoseCameraView.bufferToUprightMatrix(rotation, src.width, src.height, m)
    Canvas(out!!).drawBitmap(src, m, rotatePaint)
    return out
  }

  private fun scaleDown(src: Bitmap, maxDimension: Int): Bitmap {
    val longest = max(src.width, src.height)
    val base = if (src.config == Bitmap.Config.ARGB_8888) src else src.copy(Bitmap.Config.ARGB_8888, false)
    if (longest <= maxDimension) return base
    val scale = maxDimension.toDouble() / longest
    return Bitmap.createScaledBitmap(base, max(2, (base.width * scale).roundToInt()), max(2, (base.height * scale).roundToInt()), true)
  }

  /**
   * The frame retriever usually applies the video's rotation already. If the bitmap's shape
   * doesn't match the upright video shape, rotate it ourselves.
   */
  private fun ensureUpright(bitmap: Bitmap, info: VideoInfo): Bitmap {
    if (info.rotation == 0 || info.width == info.height) return bitmap
    val wantPortrait = info.height > info.width
    val isPortrait = bitmap.height > bitmap.width
    if (wantPortrait == isPortrait) return bitmap
    val m = Matrix().apply { postRotate(info.rotation.toFloat()) }
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, m, true)
  }

  // ---------------------------------------------------------------------------
  // Sources
  // ---------------------------------------------------------------------------

  private fun isRemote(uri: String) = uri.startsWith("http://") || uri.startsWith("https://")

  private fun setRetrieverSource(retriever: MediaMetadataRetriever, uri: String) {
    when {
      isRemote(uri) -> retriever.setDataSource(uri, HashMap())
      uri.startsWith("/") -> retriever.setDataSource(uri)
      else -> retriever.setDataSource(context, Uri.parse(uri))
    }
  }

  private fun setExtractorSource(extractor: MediaExtractor, uri: String) {
    when {
      isRemote(uri) -> extractor.setDataSource(uri, HashMap())
      uri.startsWith("/") -> extractor.setDataSource(uri)
      else -> extractor.setDataSource(context, Uri.parse(uri), null)
    }
  }
}
