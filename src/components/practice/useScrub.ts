import { useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';

interface ScrubCallbacks {
  /** x is the finger position inside the track, in pixels. */
  onStart?: (x: number) => void;
  onMove: (x: number) => void;
  onEnd?: (x: number) => void;
}

/**
 * Touch handlers for a horizontal drag track.
 *
 * The finger position is computed from the movement since the touch started (pageX), not from
 * locationX, which jumps around on Android when the finger passes over child views. The drag
 * also can't be stolen by a parent scroll view.
 */
export function useScrub(callbacks: ScrubCallbacks) {
  const cbRef = useRef(callbacks);
  useEffect(() => {
    cbRef.current = callbacks;
  });
  const startRef = useRef({ page: 0, loc: 0 });

  return useMemo(() => {
    const posOf = (e: GestureResponderEvent) => startRef.current.loc + (e.nativeEvent.pageX - startRef.current.page);
    const end = (e: GestureResponderEvent) => cbRef.current.onEnd?.(posOf(e));
    return {
      onStartShouldSetResponder: () => true,
      onMoveShouldSetResponder: () => true,
      onResponderTerminationRequest: () => false,
      onResponderGrant: (e: GestureResponderEvent) => {
        startRef.current = { page: e.nativeEvent.pageX, loc: e.nativeEvent.locationX };
        cbRef.current.onStart?.(startRef.current.loc);
        cbRef.current.onMove(startRef.current.loc);
      },
      onResponderMove: (e: GestureResponderEvent) => cbRef.current.onMove(posOf(e)),
      onResponderRelease: end,
      onResponderTerminate: end,
    };
  }, []);
}

type Throttled<T> = ((value: T) => void) & {
  cancel: () => void;
  dispose: () => void;
  setFn: (fn: (value: T) => void) => void;
};

/** Leading + trailing throttle that always delivers the newest value. */
function makeThrottle<T>(initialFn: (value: T) => void, ms: number): Throttled<T> {
  let fn = initialFn;
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { v: T } | null = null;
  const flush = () => {
    timer = null;
    if (!pending) return;
    const { v } = pending;
    pending = null;
    last = Date.now();
    fn(v);
  };
  const call = ((value: T) => {
    pending = { v: value };
    const wait = ms - (Date.now() - last);
    if (wait <= 0) {
      if (timer) clearTimeout(timer);
      flush();
    } else if (!timer) {
      timer = setTimeout(flush, wait);
    }
  }) as Throttled<T>;
  /** Drops anything still waiting (call before sending a final, exact value). */
  call.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };
  call.dispose = call.cancel;
  call.setFn = (next) => {
    fn = next;
  };
  return call;
}

/**
 * Calls `fn` at most once every `ms` milliseconds, always delivering the latest value.
 * Used so a drag doesn't flood the video with seeks (which makes it unable to show any frame).
 */
export function useThrottled<T>(fn: (value: T) => void, ms: number): Throttled<T> {
  const [throttled] = useState(() => makeThrottle<T>(fn, ms));
  // Always call the newest callback (it may capture new props each render).
  useEffect(() => {
    throttled.setFn(fn);
  });
  useEffect(() => () => throttled.dispose(), [throttled]);
  return throttled;
}
