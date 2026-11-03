package expo.modules.dancematepose

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.view.View

/**
 * Draws a camera frame and the skeleton detected *in that same frame* together.
 *
 * A normal camera preview shows each frame immediately, while the pose for that frame is
 * only ready a few dozen milliseconds later, so the skeleton always trails the body. Here the
 * picture and its skeleton are presented at the same moment, so every frame shown has its
 * skeleton exactly on the body.
 */
internal class SyncedPoseView(context: Context) : View(context) {
  private val density = resources.displayMetrics.density

  var showSkeleton = true
    set(value) { field = value; invalidate() }
  var boneColor: Int = Color.parseColor("#00F5D4")
    set(value) { field = value; invalidate() }
  var jointColor: Int = Color.parseColor("#70FFF0")
    set(value) { field = value; invalidate() }
  var highlightColor: Int = Color.parseColor("#EF4444")
  var strokeWidthDp = 3f
    set(value) { field = value; invalidate() }
  var highlight: Set<Int> = emptySet()
    set(value) { field = value; invalidate() }
  /** 0..255. Lets a video layer underneath show through (ghost overlay mode). */
  var frameAlpha = 255
    set(value) { field = value; invalidate() }
  var mirror = false
    set(value) { field = value; invalidate() }

  /** Called with frames that are no longer on screen, so their memory can be reused. */
  var onFrameRecycled: ((Bitmap) -> Unit)? = null

  private var frame: Bitmap? = null
  private var previousFrame: Bitmap? = null
  private var frameW = 0
  private var frameH = 0
  // Landmarks normalized to the frame (0..1), and their visibility.
  private var norm: FloatArray? = null
  private var vis: FloatArray? = null
  private val px = FloatArray(NUM_LANDMARKS * 2)

  private val framePaint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
  private val dst = RectF()
  private val bonePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeCap = Paint.Cap.ROUND
  }
  private val jointPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
  private val jointOutline = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    color = Color.BLACK
  }

  init {
    setWillNotDraw(false)
  }

  /** Shows a new frame and its pose (null pose = nobody detected in that frame). */
  fun present(bitmap: Bitmap, landmarks: FloatArray?, visibility: FloatArray?) {
    // Keep the frame drawn last time alive one extra frame: the renderer may still be using it.
    previousFrame?.let { old -> if (old !== bitmap) onFrameRecycled?.invoke(old) }
    previousFrame = frame
    frame = bitmap
    frameW = bitmap.width
    frameH = bitmap.height
    norm = landmarks
    vis = visibility
    invalidate()
  }

  fun clear() {
    // Hand both frames back so the frame pool never runs dry (that froze the picture).
    previousFrame?.let { onFrameRecycled?.invoke(it) }
    frame?.let { if (it !== previousFrame) onFrameRecycled?.invoke(it) }
    previousFrame = null
    frame = null
    norm = null
    vis = null
    invalidate()
  }

  /**
   * Maps frame-normalized landmarks to view-normalized coordinates exactly as drawn
   * (center crop + mirror), for JavaScript consumers. Returns null if the size is unknown.
   */
  fun toViewNormalized(landmarks: FloatArray): FloatArray? {
    val vw = width.toFloat()
    val vh = height.toFloat()
    if (vw <= 0f || vh <= 0f || frameW == 0 || frameH == 0) return null
    val scale = maxOf(vw / frameW, vh / frameH)
    val dw = frameW * scale
    val dh = frameH * scale
    val dx = (vw - dw) / 2f
    val dy = (vh - dh) / 2f
    val out = FloatArray(landmarks.size)
    for (i in 0 until landmarks.size / 2) {
      var x = (dx + landmarks[i * 2] * dw) / vw
      val y = (dy + landmarks[i * 2 + 1] * dh) / vh
      if (mirror) x = 1f - x
      out[i * 2] = x
      out[i * 2 + 1] = y
    }
    return out
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val f = frame ?: return
    if (f.isRecycled) return
    val vw = width.toFloat()
    val vh = height.toFloat()
    val scale = maxOf(vw / f.width, vh / f.height)
    val dw = f.width * scale
    val dh = f.height * scale
    val dx = (vw - dw) / 2f
    val dy = (vh - dh) / 2f

    canvas.save()
    if (mirror) canvas.scale(-1f, 1f, vw / 2f, 0f)

    if (frameAlpha > 0) {
      framePaint.alpha = frameAlpha
      dst.set(dx, dy, dx + dw, dy + dh)
      canvas.drawBitmap(f, null, dst, framePaint)
    }

    val n = norm
    val v = vis
    if (showSkeleton && n != null && v != null && n.size >= NUM_LANDMARKS * 2) {
      for (i in 0 until NUM_LANDMARKS) {
        px[i * 2] = dx + n[i * 2] * dw
        px[i * 2 + 1] = dy + n[i * 2 + 1] * dh
      }
      drawSkeleton(canvas, v)
    }
    canvas.restore()
  }

  private fun drawSkeleton(canvas: Canvas, v: FloatArray) {
    val stroke = strokeWidthDp * density
    for (bone in CONNECTIONS) {
      val a = bone[0]
      val b = bone[1]
      val visible = minOf(v[a], v[b])
      if (visible < MIN_VISIBLE) continue
      val hot = a in highlight || b in highlight
      bonePaint.strokeWidth = if (hot) stroke + 1.5f * density else stroke
      bonePaint.color = if (hot) highlightColor else boneColor
      bonePaint.alpha = if (visible < SOLID_VISIBLE) 110 else 255
      canvas.drawLine(px[a * 2], px[a * 2 + 1], px[b * 2], px[b * 2 + 1], bonePaint)
    }

    jointOutline.strokeWidth = 1.5f * density
    for (i in 0 until NUM_LANDMARKS) {
      if (i in FACE_DETAIL) continue
      val visible = v[i]
      if (visible < MIN_VISIBLE) continue
      val major = i in MAJOR_JOINTS
      val hot = i in highlight
      val radius = (if (i == 0) 7f else if (hot) 6.5f else if (major) 5.5f else 4f) * density
      jointPaint.color = if (hot) highlightColor else if (major) jointColor else Color.WHITE
      jointPaint.alpha = if (visible < SOLID_VISIBLE) 170 else 255
      canvas.drawCircle(px[i * 2], px[i * 2 + 1], radius, jointPaint)
      canvas.drawCircle(px[i * 2], px[i * 2 + 1], radius, jointOutline)
    }
  }

  companion object {
    private const val MIN_VISIBLE = 0.3f
    private const val SOLID_VISIBLE = 0.5f

    // Same bones as SKELETON_CONNECTIONS in src/constants/skeletonJoints.ts.
    // Head is a single point (the nose): no face lines.
    val CONNECTIONS = arrayOf(
      intArrayOf(11, 12), intArrayOf(11, 23), intArrayOf(12, 24), intArrayOf(23, 24),
      intArrayOf(11, 13), intArrayOf(13, 15), intArrayOf(15, 21), intArrayOf(15, 19),
      intArrayOf(15, 17), intArrayOf(19, 17),
      intArrayOf(12, 14), intArrayOf(14, 16), intArrayOf(16, 22), intArrayOf(16, 20),
      intArrayOf(16, 18), intArrayOf(20, 18),
      intArrayOf(23, 25), intArrayOf(25, 27), intArrayOf(27, 29), intArrayOf(29, 31), intArrayOf(27, 31),
      intArrayOf(24, 26), intArrayOf(26, 28), intArrayOf(28, 30), intArrayOf(30, 32), intArrayOf(28, 32),
    )

    val MAJOR_JOINTS = setOf(0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28)

    // Eyes, ears and mouth are not drawn: the nose alone marks the head.
    val FACE_DETAIL = setOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)

    /** Parses "#RGB", "#RRGGBB", "#AARRGGBB" and "rgba(r, g, b, a)" / "rgb(r, g, b)". */
    fun parseColor(value: String?, fallback: Int): Int {
      if (value.isNullOrBlank()) return fallback
      val s = value.trim()
      return try {
        when {
          s.startsWith("rgb", ignoreCase = true) -> {
            val parts = s.substringAfter("(").substringBefore(")").split(",").map { it.trim() }
            val r = parts[0].toFloat().toInt()
            val g = parts[1].toFloat().toInt()
            val b = parts[2].toFloat().toInt()
            val a = if (parts.size > 3) (parts[3].toFloat() * 255).toInt() else 255
            Color.argb(a.coerceIn(0, 255), r, g, b)
          }
          s.length == 4 && s.startsWith("#") -> {
            val r = s[1].toString().repeat(2)
            val g = s[2].toString().repeat(2)
            val b = s[3].toString().repeat(2)
            Color.parseColor("#$r$g$b")
          }
          s.equals("transparent", ignoreCase = true) -> Color.TRANSPARENT
          else -> Color.parseColor(s)
        }
      } catch (t: Throwable) {
        fallback
      }
    }
  }
}
