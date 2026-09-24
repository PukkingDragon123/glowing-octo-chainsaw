export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inBack: (t: number) => {
    const c1 = 1.70158;
    return (c1 + 1) * t * t * t - c1 * t * t;
  },
  outElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  outBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

interface Job {
  start: number;
  duration: number;
  ease: Ease;
  update: (t: number) => void;
  resolve: () => void;
  group: string;
  cancelled: boolean;
}

/**
 * Time-driven tweens advanced by the game loop (so they pause with the game).
 * Every tween returns a promise, which keeps animation scripts readable with async/await.
 */
export class Tweens {
  private jobs: Job[] = [];
  private waits: { at: number; resolve: () => void; group: string }[] = [];
  time = 0;

  tween(duration: number, update: (t: number) => void, e: Ease = ease.inOutCubic, group = 'default'): Promise<void> {
    return new Promise((resolve) => {
      if (duration <= 0) {
        update(1);
        resolve();
        return;
      }
      this.jobs.push({ start: this.time, duration, ease: e, update, resolve, group, cancelled: false });
    });
  }

  wait(seconds: number, group = 'default'): Promise<void> {
    return new Promise((resolve) => this.waits.push({ at: this.time + seconds, resolve, group }));
  }

  /** Stop all tweens/waits in a group. Their promises never resolve (scripts simply stop). */
  cancel(group: string) {
    for (const j of this.jobs) if (j.group === group) j.cancelled = true;
    this.jobs = this.jobs.filter((j) => !j.cancelled);
    this.waits = this.waits.filter((w) => w.group !== group);
  }

  update(dt: number) {
    this.time += dt;
    const done: Job[] = [];
    for (const j of this.jobs) {
      const t = Math.min(1, (this.time - j.start) / j.duration);
      j.update(j.ease(t));
      if (t >= 1) done.push(j);
    }
    if (done.length) {
      this.jobs = this.jobs.filter((j) => !done.includes(j));
      for (const j of done) j.resolve();
    }
    if (this.waits.length) {
      const ready = this.waits.filter((w) => w.at <= this.time);
      if (ready.length) {
        this.waits = this.waits.filter((w) => w.at > this.time);
        for (const w of ready) w.resolve();
      }
    }
  }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** Deterministic PRNG so layouts look the same on every visit. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
