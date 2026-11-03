# MediaPipe calls into Java from native code and uses protobuf reflection.
# Code shrinking must not rename or remove any of it, or pose detection crashes at startup.
-keep class com.google.mediapipe.** { *; }
-keep class com.google.protobuf.** { *; }
-keep class com.google.android.datatransport.** { *; }
# MediaPipe logs through Flogger, which finds its backend class by name at startup.
# If it is renamed, MediaPipe's Graph class fails to load and the pose detector can't start.
-keep class com.google.common.flogger.** { *; }
-dontwarn com.google.common.flogger.**
-dontwarn com.google.mediapipe.**
-dontwarn com.google.protobuf.**
-dontwarn com.google.auto.value.**
-dontwarn javax.annotation.**

# Our native module (views, events, props are looked up by name).
-keep class expo.modules.dancematepose.** { *; }
