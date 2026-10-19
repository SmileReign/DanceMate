import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export interface DanceVideoPlayerRef {
  playAsync: () => Promise<void>;
  pauseAsync: () => Promise<void>;
  setPositionAsync: (positionMillis: number) => Promise<void>;
  setRateAsync: (rate: number) => Promise<void>;
  getNativeVideoElement: () => HTMLVideoElement | null;
}

interface DanceVideoPlayerProps {
  sourceUri: string;
  isPlaying: boolean;
  playbackSpeed: number;
  isFlipped: boolean;
  opacity?: number;
  isMuted?: boolean;
  onPlaybackUpdate?: (positionSeconds: number, durationSeconds: number) => void;
  style?: any;
}

export const DanceVideoPlayer = forwardRef<DanceVideoPlayerRef, DanceVideoPlayerProps>(
  (
    {
      sourceUri,
      isPlaying,
      playbackSpeed,
      isFlipped,
      opacity = 1.0,
      isMuted = false,
      onPlaybackUpdate,
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
          const targetSeconds = positionMillis / 1000;
          if (Platform.OS === 'web' && webVideoRef.current) {
            webVideoRef.current.currentTime = targetSeconds;
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
            crossOrigin="anonymous"
            playsInline
            muted={isMuted}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
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
            onLoadedMetadata={() => {
              if (webVideoRef.current && onPlaybackUpdate) {
                onPlaybackUpdate(
                  webVideoRef.current.currentTime,
                  webVideoRef.current.duration || 1
                );
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
          contentFit="cover"
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
