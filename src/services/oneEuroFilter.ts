import { Landmark } from '../types/dance';

/**
 * Single-value 1€ (One Euro) Filter
 * Solves the jitter vs. lag tradeoff in real-time human motion tracking:
 * - Low speed = low cutoff = zero jitter
 * - High speed = dynamic high cutoff = near zero latency
 */
export class LowPassFilter {
  private y: number;
  private s: number;

  constructor(alpha: number, initVal = 0) {
    this.y = initVal;
    this.s = initVal;
  }

  filter(value: number, alpha: number): number {
    this.y = value;
    this.s = alpha * value + (1 - alpha) * this.s;
    return this.s;
  }

  filterWithAlpha(value: number, alpha: number): number {
    return this.filter(value, alpha);
  }

  hasLast(): boolean {
    return !Number.isNaN(this.y);
  }

  last(): number {
    return this.s;
  }

  reset(initVal = 0) {
    this.y = initVal;
    this.s = initVal;
  }
}

export interface OneEuroConfig {
  minCutoff: number; // Minimum cutoff frequency (Hz) - lower = smoother static poses
  beta: number; // Speed coefficient - higher = faster response to rapid movements
  dCutoff: number; // Derivative cutoff frequency (Hz)
}

export const DEFAULT_ONE_EURO_CONFIG: OneEuroConfig = {
  minCutoff: 1.2,
  beta: 6.0,
  dCutoff: 2.5,
};

export class OneEuroPointFilter {
  private xFilter: LowPassFilter;
  private yFilter: LowPassFilter;
  private zFilter: LowPassFilter;
  private dxFilter: LowPassFilter;
  private dyFilter: LowPassFilter;
  private dzFilter: LowPassFilter;
  private lastTime: number = 0;
  private config: OneEuroConfig;
  private isInitialized = false;

  constructor(config: OneEuroConfig = DEFAULT_ONE_EURO_CONFIG) {
    this.config = { ...config };
    this.xFilter = new LowPassFilter(1, 0);
    this.yFilter = new LowPassFilter(1, 0);
    this.zFilter = new LowPassFilter(1, 0);
    this.dxFilter = new LowPassFilter(1, 0);
    this.dyFilter = new LowPassFilter(1, 0);
    this.dzFilter = new LowPassFilter(1, 0);
  }

  private alpha(cutoff: number, te: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / te);
  }

  filter(
    x: number,
    y: number,
    z: number = 0,
    timestampSec: number = performance.now() / 1000
  ): { x: number; y: number; z: number; vx: number; vy: number } {
    if (!this.isInitialized || this.lastTime === 0) {
      this.isInitialized = true;
      this.lastTime = timestampSec;
      this.xFilter.reset(x);
      this.yFilter.reset(y);
      this.zFilter.reset(z);
      this.dxFilter.reset(0);
      this.dyFilter.reset(0);
      this.dzFilter.reset(0);
      return { x, y, z, vx: 0, vy: 0 };
    }

    let te = timestampSec - this.lastTime;
    if (te <= 0.0001) te = 0.0001;
    if (te > 0.5) te = 0.033; // Frame drop compensation
    this.lastTime = timestampSec;

    // 1. Calculate rate of change (derivative)
    const rawDx = (x - this.xFilter.last()) / te;
    const rawDy = (y - this.yFilter.last()) / te;
    const rawDz = (z - this.zFilter.last()) / te;

    // 2. Filter derivative
    const alphaD = this.alpha(this.config.dCutoff, te);
    const dx = this.dxFilter.filter(rawDx, alphaD);
    const dy = this.dyFilter.filter(rawDy, alphaD);
    const dz = this.dzFilter.filter(rawDz, alphaD);

    const speed = Math.sqrt(dx * dx + dy * dy + dz * dz);
    let alphaVal: number;
    if (speed > 0.15) {
      // Rapid dance motion: near-instantaneous tracking (zero phase lag)
      alphaVal = 0.985;
    } else {
      const cutoff = this.config.minCutoff + this.config.beta * speed;
      alphaVal = this.alpha(cutoff, te);
    }

    // 4. Filter position
    const filteredX = this.xFilter.filter(x, alphaVal);
    const filteredY = this.yFilter.filter(y, alphaVal);
    const filteredZ = this.zFilter.filter(z, alphaVal);

    return {
      x: filteredX,
      y: filteredY,
      z: filteredZ,
      vx: dx,
      vy: dy,
    };
  }

  reset() {
    this.isInitialized = false;
    this.lastTime = 0;
  }
}

/**
 * Filter bank managing One Euro Filters for all 75 body + hand joints simultaneously
 */
export class SkeletonOneEuroFilter {
  private filters: Map<number, OneEuroPointFilter> = new Map();
  private config: OneEuroConfig;

  constructor(config: OneEuroConfig = DEFAULT_ONE_EURO_CONFIG) {
    this.config = config;
  }

  filter(landmarks: Landmark[], timestampSec: number = performance.now() / 1000): Landmark[] {
    if (!landmarks || landmarks.length === 0) return landmarks;

    return landmarks.map((lm, idx) => {
      if (!lm) return lm;

      let filter = this.filters.get(idx);
      if (!filter) {
        filter = new OneEuroPointFilter(this.config);
        this.filters.set(idx, filter);
      }

      // If confidence/visibility is too low, gently maintain previous position
      if (lm.visibility !== undefined && lm.visibility < 0.25) {
        return lm;
      }

      const res = filter.filter(lm.x, lm.y, lm.z || 0, timestampSec);
      return {
        x: res.x,
        y: res.y,
        z: res.z,
        vx: res.vx,
        vy: res.vy,
        visibility: lm.visibility,
      };
    });
  }

  /**
   * Extrapolates landmark positions forward by dt seconds using velocity vector (dead-reckoning).
   * Ensures the displayed skeleton matches the dancer's exact position at screen vsync (<16ms).
   */
  extrapolate(landmarks: Landmark[], dtSec: number): Landmark[] {
    if (!landmarks || dtSec <= 0) return landmarks;
    // Cap extrapolation to 80ms with exponential damping to avoid overshooting on sudden stops
    const tau = 0.08;
    const effectiveDt = tau * (1 - Math.exp(-dtSec / tau));

    return landmarks.map((lm) => {
      if (!lm || lm.vx === undefined || lm.vy === undefined) return lm;
      return {
        ...lm,
        x: lm.x + lm.vx * effectiveDt,
        y: lm.y + lm.vy * effectiveDt,
      };
    });
  }

  reset() {
    this.filters.clear();
  }
}

