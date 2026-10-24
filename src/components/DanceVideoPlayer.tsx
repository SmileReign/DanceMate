import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export interface DanceVideoPlayerRef {
  playAsync: () => Promise<void>;
  pauseAsync: () => Promise<void>;
  setPositionAsync: (positionMillis: number) => Promise<void>;
  setRateAsync: (rate: number) => Promise<void>;
  getNativeVideoElement: () => HTMLVideoElement | null;
  waitForReadyAsync: (timeoutMs?: number) => Promise<boolean>;
  getVideoDuration: () => number;
  getVideoDimensions: () => { width: number; height: number };
}

interface DanceVideoPlayerProps {
  sourceUri: string;
  isPlaying: boolean;
  playbackSpeed: number;
  isFlipped: boolean;
  fitMode?: 'cover' | 'contain';
  opacity?: number;
  isMuted?: boolean;
  onPlaybackUpdate?: (positionSeconds: number, durationSeconds: number) => void;
  onDimensionsChange?: (width: number, height: number) => void;
  style?: any;
}

export const DanceVideoPlayer = forwardRef<DanceVideoPlayerRef, DanceVideoPlayerProps>(
  (
    {
      sourceUri,
      isPlaying,
      playbackSpeed,
      isFlipped,
      fitMode = 'contain',
      opacity = 1.0,
      isMuted = false,
      onPlaybackUpdate,
      onDimensionsChange,
      style,
    },
    ref
  ) => {
    const webVideoRef = useRef<HTMLVideoElement | null>(null);

    // Modern Expo SDK 58 expo-video player
    const player = useVideoPlayer(sourceUri || null, (p) => {
      p.loop = false;
      p.muted = isMuted;
      p.playbackRate = playbackSpeed;
      p.timeUpdateEventInterval = 0.05;
    });

    // Expose imperative handle compatible with both Mobile and Web
    useImperativeHandle(
      ref,
      () => ({
        playAsync: async () => {
          if (Platform.OS === 'web' && webVideoRef.current) {
            try {
              await webVideoRef.current.play();
            } catch {}
          } else if (player) {
            try {
              player.play();
            } catch {}
          }
        },
        pauseAsync: async () => {
          if (Platform.OS === 'web' && webVideoRef.current) {
            webVideoRef.current.pause();
          } else if (player) {
            try {
              player.pause();
            } catch {}
          }
        },
        setPositionAsync: async (positionMillis: number) => {
          const targetSeconds = Math.max(0, positionMillis / 1000);
          if (Platform.OS === 'web' && webVideoRef.current) {
            const v = webVideoRef.current;
            if (Math.abs(v.currentTime - targetSeconds) < 0.05 && !v.seeking) {
              if (onPlaybackUpdate) onPlaybackUpdate(targetSeconds, v.duration || 1);
              return;
            }
            await new Promise<void>((resolve) => {
              let resolved = false;
              const onSeeked = () => {
                if (resolved) return;
                resolved = true;
                v.removeEventListener('seeked', onSeeked);
                clearTimeout(t);
                resolve();
              };
              const t = setTimeout(onSeeked, 400);
              v.addEventListener('seeked', onSeeked);
              v.currentTime = targetSeconds;
            });
            if (onPlaybackUpdate) onPlaybackUpdate(targetSeconds, v.duration || 1);
          } else if (player) {
            try {
              player.currentTime = targetSeconds;
              if (onPlaybackUpdate) {
                onPlaybackUpdate(targetSeconds, player.duration || 1);
              }
            } catch {}
          }
        },
        setRateAsync: async (rate: number) => {
          if (Platform.OS === 'web' && webVideoRef.current) {
            webVideoRef.current.playbackRate = rate;
          } else if (player) {
            try {
              player.playbackRate = rate;
            } catch {}
          }
        },
        getNativeVideoElement: () => {
          return webVideoRef.current;
        },
        waitForReadyAsync: async (timeoutMs: number = 6000): Promise<boolean> => {
          if (Platform.OS === 'web' && webVideoRef.current) {
            const v = webVideoRef.current;
            if (v.readyState >= 2 && v.videoWidth > 0) return true;
            return new Promise<boolean>((resolve) => {
              let resolved = false;
              const finish = (ok: boolean) => {
                if (resolved) return;
                resolved = true;
                v.removeEventListener('loadeddata', onReady);
                v.removeEventListener('canplay', onReady);
                v.removeEventListener('error', onError);
                clearTimeout(timer);
                resolve(ok);
              };
              const onReady = () => finish(true);
              const onError = () => finish(false);
              v.addEventListener('loadeddata', onReady);
              v.addEventListener('canplay', onReady);
              v.addEventListener('error', onError);
              const timer = setTimeout(() => {
                finish(v.readyState >= 1);
              }, timeoutMs);
            });
          }
          return true;
        },
        getVideoDuration: () => {
          if (Platform.OS === 'web' && webVideoRef.current) {
            return webVideoRef.current.duration || 0;
          }
          return player?.duration || 0;
        },
        getVideoDimensions: () => {
          if (Platform.OS === 'web' && webVideoRef.current) {
            return {
              width: webVideoRef.current.videoWidth || 0,
              height: webVideoRef.current.videoHeight || 0,
            };
          }
          return { width: 0, height: 0 };
        },
      }),
      [player, onPlaybackUpdate]
    );

    // Sync play/pause state for mobile player
    useEffect(() => {
      if (Platform.OS === 'web' || !player) return;
      try {
        if (isPlaying) {
          player.play();
        } else {
          player.pause();
        }
      } catch {}
    }, [player, isPlaying]);

    // Sync rate and muted state for mobile player
    useEffect(() => {
      if (Platform.OS === 'web' || !player) return;
      try {
        player.playbackRate = playbackSpeed;
      } catch {}
    }, [player, playbackSpeed]);

    useEffect(() => {
      if (Platform.OS === 'web' || !player) return;
      try {
        player.muted = isMuted;
      } catch {}
    }, [player, isMuted]);

    // Native timeUpdate and sourceLoad event subscriptions
    useEffect(() => {
      if (Platform.OS === 'web' || !player) return;

      const timeSub = player.addListener('timeUpdate', (event) => {
        if (onPlaybackUpdate) {
          onPlaybackUpdate(event.currentTime, player.duration || 1);
        }
      });

      const loadSub = player.addListener('sourceLoad', (event) => {
        if (onPlaybackUpdate) {
          onPlaybackUpdate(player.currentTime, event.duration || 1);
        }
      });

      return () => {
        timeSub.remove();
        loadSub.remove();
      };
    }, [player, onPlaybackUpdate]);

    // Web sync
    useEffect(() => {
      if (Platform.OS !== 'web' || !webVideoRef.current) return;
      webVideoRef.current.playbackRate = playbackSpeed;
      if (isPlaying) {
        webVideoRef.current.play().catch(() => {});
      } else {
        webVideoRef.current.pause();
      }
    }, [isPlaying, playbackSpeed]);

    // Web fallback for desktop browser and MediaPipe Web Vision API
    if (Platform.OS === 'web') {
      return (
        <View style={[styles.container, style, { opacity }]}>
          <video
            ref={webVideoRef as any}
            src={sourceUri}
            crossOrigin={
              sourceUri && (sourceUri.startsWith('http://') || sourceUri.startsWith('https://'))
                ? 'anonymous'
                : undefined
            }
            playsInline
            muted={isMuted}
            preload="auto"
            onError={() => {
              if (webVideoRef.current && webVideoRef.current.crossOrigin) {
                console.warn('Retrying video load without crossOrigin attribute');
                webVideoRef.current.removeAttribute('crossOrigin');
                webVideoRef.current.load();
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: fitMode,
              transform: isFlipped ? 'scaleX(-1)' : 'none',
            }}
            onTimeUpdate={() => {
              if (webVideoRef.current && onPlaybackUpdate) {
                onPlaybackUpdate(
                  webVideoRef.current.currentTime,
                  webVideoRef.current.duration || 1
                );
              }
            }}
            onLoadedData={() => {
              if (webVideoRef.current && onDimensionsChange && webVideoRef.current.videoWidth > 0) {
                onDimensionsChange(
                  webVideoRef.current.videoWidth,
                  webVideoRef.current.videoHeight
                );
              }
            }}
            onCanPlay={() => {
              if (webVideoRef.current && onDimensionsChange && webVideoRef.current.videoWidth > 0) {
                onDimensionsChange(
                  webVideoRef.current.videoWidth,
                  webVideoRef.current.videoHeight
                );
              }
            }}
            onLoadedMetadata={() => {
              if (webVideoRef.current) {
                if (onPlaybackUpdate) {
                  onPlaybackUpdate(
                    webVideoRef.current.currentTime,
                    webVideoRef.current.duration || 1
                  );
                }
                if (onDimensionsChange && webVideoRef.current.videoWidth > 0) {
                  onDimensionsChange(
                    webVideoRef.current.videoWidth,
                    webVideoRef.current.videoHeight
                  );
                }
              }
            }}
          />
        </View>
      );
    }

    // Native iOS / Android VideoView using expo-video
    return (
      <View style={[styles.container, style, { opacity }]}>
        <VideoView
          player={player}
          contentFit={fitMode}
          nativeControls={false}
          surfaceType={isFlipped ? 'textureView' : 'surfaceView'}
          style={[
            StyleSheet.absoluteFill,
            isFlipped ? { transform: [{ scaleX: -1 }] } : undefined,
          ]}
        />
      </View>
    );
  }
);

DanceVideoPlayer.displayName = 'DanceVideoPlayer';

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
});
