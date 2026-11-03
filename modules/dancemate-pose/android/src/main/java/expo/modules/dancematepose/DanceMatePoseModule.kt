package expo.modules.dancematepose

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executors

class DanceMatePoseModule : Module() {
  // Video work runs on its own thread so it never blocks other Expo modules.
  private val videoExecutor = Executors.newSingleThreadExecutor()
  @Volatile private var activeAnalyzer: VideoPoseAnalyzer? = null

  override fun definition() = ModuleDefinition {
    Name("DanceMatePose")

    Events("onVideoProgress")

    Function("isAvailable") { true }

    Function("cancelVideoAnalysis") {
      activeAnalyzer?.cancelled = true
    }

    AsyncFunction("getVideoInfo") { uri: String, promise: Promise ->
      val ctx = appContext.reactContext
      if (ctx == null) {
        promise.reject("ERR_NO_CONTEXT", "App is not ready", null)
        return@AsyncFunction
      }
      videoExecutor.execute {
        try {
          val info = VideoPoseAnalyzer(ctx).readInfo(uri)
          promise.resolve(
            mapOf(
              "width" to info.width,
              "height" to info.height,
              "rotation" to info.rotation,
              "durationMs" to info.durationMs.toDouble(),
            )
          )
        } catch (t: Throwable) {
          promise.reject("ERR_VIDEO_INFO", t.message ?: "Could not read video", t)
        }
      }
    }

    AsyncFunction("detectPosesInVideoFrame") { uri: String, timeMs: Double, numPoses: Int, promise: Promise ->
      val ctx = appContext.reactContext
      if (ctx == null) {
        promise.reject("ERR_NO_CONTEXT", "App is not ready", null)
        return@AsyncFunction
      }
      videoExecutor.execute {
        try {
          val result = VideoPoseAnalyzer(ctx).detectSingleFrame(uri, timeMs.toLong(), numPoses, 1280)
          promise.resolve(result)
        } catch (t: Throwable) {
          promise.reject("ERR_FRAME_DETECTION", t.message ?: "Could not analyse the frame", t)
        }
      }
    }

    AsyncFunction("analyzeVideo") { uri: String, options: Map<String, Any?>, promise: Promise ->
      val ctx = appContext.reactContext
      if (ctx == null) {
        promise.reject("ERR_NO_CONTEXT", "App is not ready", null)
        return@AsyncFunction
      }
      val opts = AnalyzeOptions(
        startMs = (options["startMs"] as? Number)?.toLong() ?: 0L,
        endMs = (options["endMs"] as? Number)?.toLong() ?: 0L,
        fps = (options["fps"] as? Number)?.toDouble() ?: 30.0,
        numPoses = (options["numPoses"] as? Number)?.toInt() ?: 1,
        model = PoseModel.from(options["model"] as? String, PoseModel.HEAVY),
        maxDimension = (options["maxDimension"] as? Number)?.toInt() ?: 960,
      )
      activeAnalyzer?.cancelled = true
      val analyzer = VideoPoseAnalyzer(ctx)
      activeAnalyzer = analyzer
      videoExecutor.execute {
        try {
          val result = analyzer.analyze(uri, opts) { progress, processed, timeMs, poses ->
            sendEvent(
              "onVideoProgress",
              mapOf(
                "progress" to progress,
                "processedFrames" to processed,
                "timeMs" to timeMs,
                "posesInFrame" to poses,
              )
            )
          }
          promise.resolve(result)
        } catch (t: Throwable) {
          promise.reject("ERR_VIDEO_ANALYSIS", t.message ?: "Video analysis failed", t)
        } finally {
          if (activeAnalyzer === analyzer) activeAnalyzer = null
        }
      }
    }

    OnDestroy {
      activeAnalyzer?.cancelled = true
      videoExecutor.shutdown()
    }

    View(PoseCameraView::class) {
      Events("onPose", "onTrackerStatus")

      Prop("facing") { view: PoseCameraView, value: String? -> view.setFacing(value) }
      Prop("active") { view: PoseCameraView, value: Boolean? -> view.setActive(value ?: true) }
      Prop("mirror") { view: PoseCameraView, value: Boolean? -> view.setMirror(value ?: true) }
      Prop("emitLandmarks") { view: PoseCameraView, value: Boolean? -> view.setEmitLandmarks(value ?: true) }
      Prop("model") { view: PoseCameraView, value: String? -> view.setModel(value) }
      Prop("showSkeleton") { view: PoseCameraView, value: Boolean? -> view.setShowSkeleton(value ?: true) }
      Prop("skeletonColor") { view: PoseCameraView, value: String? -> view.setSkeletonColor(value) }
      Prop("jointColor") { view: PoseCameraView, value: String? -> view.setJointColor(value) }
      Prop("strokeWidth") { view: PoseCameraView, value: Double? -> view.setStrokeWidth(value ?: 3.0) }
      Prop("highlightJoints") { view: PoseCameraView, value: List<Int>? -> view.setHighlightJoints(value) }
      Prop("frameOpacity") { view: PoseCameraView, value: Double? -> view.setFrameOpacity(value ?: 1.0) }

      OnViewDestroys { view: PoseCameraView -> view.release() }
    }
  }
}
