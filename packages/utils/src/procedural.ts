import { resolveEasing, type Easing, type EasingInput } from '@underlying/core'
import { samplesToEasing, type CurvePoint } from './curve'
import { mulberry32 } from './prng'

const TWO_PI = Math.PI * 2

export type WiggleWave = 'sine' | 'triangle' | 'square'
export interface WiggleOptions {
  /** Damping ratio: amplitude falls exponentially over progress. 0 = a steady, linearly-decaying wobble. Default 3. */
  decay?: number
  /** Carrier shape. Default 'sine'. */
  wave?: WiggleWave
}

// All carriers equal 1 at phase 0, so the wiggle starts exactly at 0 for any shape.
const carrier = (wave: WiggleWave): ((phase: number) => number) => {
  if (wave === 'triangle') {
    return (phase) => {
      const f = phase / TWO_PI
      return 1 - 4 * Math.abs(Math.round(f) - f)
    }
  }
  if (wave === 'square') return (phase) => Math.sign(Math.cos(phase)) || 1
  return (phase) => Math.cos(phase)
}

/**
 * A damped oscillator as an easing: the eased value overshoots, then wobbles with
 * decaying amplitude and settles exactly on the target. The same struck-and-settle
 * family as elastic, not a fixed-amplitude sine. Endpoint-exact for any count.
 */
export function wiggle(count = 3, options: WiggleOptions = {}): Easing {
  const decay = options.decay ?? 3
  const wave = carrier(options.wave ?? 'sine')
  const omega = count * TWO_PI
  const denom = 1 - Math.exp(-decay)
  const env =
    decay === 0
      ? (p: number): number => 1 - p
      : (p: number): number => (Math.exp(-decay * p) - Math.exp(-decay)) / denom
  return (p) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - env(p) * wave(omega * p))
}

/** A buzzier wiggle preset (more swings, less damping) for a rattling entrance. */
export function shake(count = 6, options: WiggleOptions = {}): Easing {
  const opts: WiggleOptions = { decay: options.decay ?? 1 }
  if (options.wave !== undefined) opts.wave = options.wave
  return wiggle(count, opts)
}

/**
 * Lingers through a shallow middle and races at the ends: fast in, slow across the
 * readable centre, fast out. `linearRatio` is how much of the run is the slow middle;
 * `power` is how flat that middle gets (0 = a straight line, 1 = nearly frozen).
 */
export function slow(linearRatio = 0.7, power = 0.7): Easing {
  const lr = Math.min(Math.max(linearRatio, 0), 0.95) // strictly < 1 so the fast ends always connect 0 and 1
  const k = Math.min(Math.max(power, 0), 1)
  const a = (1 - lr) / 2
  return (p) => {
    if (p <= 0) return 0
    if (p >= 1) return 1
    const r = 0.5 + (1 - k) * (p - 0.5) // shallow line through (0.5, 0.5)
    if (a <= 0) return r
    if (p < a) {
      const u = 1 - p / a
      return r * (1 - u * u * u * u)
    }
    if (p > 1 - a) {
      const u = (p - (1 - a)) / a
      return r + (1 - r) * u * u * u * u
    }
    return r
  }
}

export type RoughTaper = 'none' | 'in' | 'out' | 'both'
export interface RoughOptions {
  /** Number of random steps. Default 20. */
  points?: number
  /** Jitter size in output units. Default 0.4. */
  amplitude?: number
  /** PRNG seed; the same seed draws the same curve every run. Default 1. */
  seed?: number
  /** Fade the jitter toward the ends. Default 'both'. */
  taper?: RoughTaper
  /** false = a stepped glitch staircase; true = a jittery-but-continuous curve. Default false. */
  smooth?: boolean
  /** The baseline the jitter rides on (an easing or a named string). Default identity. */
  base?: EasingInput
}

const taperWeight = (taper: RoughTaper): ((x: number) => number) => {
  if (taper === 'in') return (x) => x
  if (taper === 'out') return (x) => 1 - x
  if (taper === 'both') return (x) => Math.sin(Math.PI * x)
  return () => 1
}

/**
 * Seeded jitter as an easing: a glitchy, stepped (or smoothed) deviation from a
 * baseline. Deterministic - the seed fixes the curve, so it is reproducible and
 * SSR-stable (no Math.random on the easing path).
 */
export function rough(options: RoughOptions = {}): Easing {
  const n = Math.max(1, Math.floor(options.points ?? 20))
  const amplitude = options.amplitude ?? 0.4
  const taper = taperWeight(options.taper ?? 'both')
  const smooth = options.smooth ?? false
  const base = resolveEasing(options.base ?? ((p: number) => p))
  const rand = mulberry32(Math.floor(options.seed ?? 1))

  const points: CurvePoint[] = []
  for (let i = 0; i <= n; i++) {
    const x = i / n
    points.push({ x, y: base(x) + (rand() * 2 - 1) * amplitude * taper(x) })
  }
  points[0] = { x: 0, y: 0 }
  points[n] = { x: 1, y: 1 }
  return samplesToEasing(points, { interpolation: smooth ? 'linear' : 'step' })
}
