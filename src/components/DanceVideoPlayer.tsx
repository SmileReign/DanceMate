import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

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
    const videoRef = useRef<Video | null>(null);
    const webVideoRef = useRef<HTMLVideoElement | null>(null);

    useImperativeHandle(ref, () => ({
      playAsync: async () => {
        if (Platform.OS === 'web' && webVideoRef.current) {
          try {
            await webVideoRef.current.play();
          } catch {}
        } else if (videoRef.current) {
          await videoRef.current.playAsync();
        }
      },
      pauseAsync: async () => {
        if (Platform.OS === 'web' && webVideoRef.current) {
          webVideoRef.current.pause();
        } else if (videoRef.current) {
          await videoRef.current.pauseAsync();
        }
      },
      setPositionAsync: async (positionMillis: number) => {
        if (Platform.OS === 'web' && webVideoRef.current) {
          webVideoRef.current.currentTime = positionMillis / 1000;
        } else if (videoRef.current) {
          await videoRef.current.setPositionAsync(positionMillis);
        }
      },
      setRateAsync: async (rate: number) => {
        if (Platform.OS === 'web' && webVideoRef.current) {
          webVideoRef.current.playbackRate = rate;
        } else if (videoRef.current) {
          await videoRef.current.setRateAsync(rate, true);
        }
      },
      getNativeVideoElement: () => {
        return webVideoRef.current;
      },
    }));

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

    const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
      if (!status.isLoaded) return;
      if (onPlaybackUpdate) {
        const pos = (status.positionMillis || 0) / 1000;
        const dur = (status.durationMillis || 0) / 1000;
        onPlaybackUpdate(pos, dur);
      }
    };

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

    return (
      <View style={[styles.container, style, { opacity }]}>
        <Video
          ref={videoRef}
          source={{ uri: sourceUri }}
          rate={playbackSpeed}
          shouldCorrectPitch={true}
          volume={isMuted ? 0 : 1.0}
          isMuted={isMuted}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isPlaying}
          isLooping={false}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
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
