import { registerEasing, type Easing, type EasingVariant } from '@underlying/core'

/** An ease family: the three GSAP variants of one curve. */
export interface EaseFamily {
  in: Easing
  out: Easing
  inOut: Easing
}

// Reflect an `in` curve into out and inOut - the standard construction.
const fromIn = (easeIn: (t: number) => number): EaseFamily => ({
  in: easeIn,
  out: (t) => 1 - easeIn(1 - t),
  inOut: (t) => (t < 0.5 ? easeIn(2 * t) / 2 : 1 - easeIn(2 - 2 * t) / 2),
})

// Elastic and bounce are classically defined out-first, so reflect from `out`.
const fromOut = (easeOut: (t: number) => number): EaseFamily => ({
  out: easeOut,
  in: (t) => 1 - easeOut(1 - t),
  inOut: (t) => (t < 0.5 ? (1 - easeOut(1 - 2 * t)) / 2 : (1 + easeOut(2 * t - 1)) / 2),
})

const power = (exponent: number): EaseFamily => fromIn((t) => t ** exponent)

/** power1 = quad, power2 = cubic, power3 = quart, power4 = quint (GSAP naming). */
export const power1: EaseFamily = power(2)
export const power2: EaseFamily = power(3)
export const power3: EaseFamily = power(4)
export const power4: EaseFamily = power(5)
export const quad = power1
export const cubic = power2
export const quart = power3
export const quint = power4

export const sine: EaseFamily = fromIn((t) => 1 - Math.cos((t * Math.PI) / 2))
export const expo: EaseFamily = fromIn((t) => (t === 0 ? 0 : 2 ** (10 * t - 10)))
export const circ: EaseFamily = fromIn((t) => 1 - Math.sqrt(1 - t * t))

/** Overshoot-and-settle. Bigger overshoot = stronger anticipation/overshoot. */
export const back = (overshoot = 1.70158): EaseFamily =>
  fromIn((t) => t * t * ((overshoot + 1) * t - overshoot))

/** Springy wobble. amplitude >= 1, period the wobble length. */
export const elastic = (amplitude = 1, period = 0.3): EaseFamily => {
  const amp = Math.max(amplitude, 1)
  const phase = (period / (2 * Math.PI)) * Math.asin(1 / amp)
  return fromOut((t) =>
    t === 0 ? 0 : t === 1 ? 1 : amp * 2 ** (-10 * t) * Math.sin(((t - phase) * (2 * Math.PI)) / period) + 1,
  )
}

const bounceOut = (t: number): number => {
  const n1 = 7.5625
  const d1 = 2.75
  if (t < 1 / d1) return n1 * t * t
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
  return n1 * (t -= 2.625 / d1) * t + 0.984375
}
export const bounce: EaseFamily = fromOut(bounceOut)

/** A staircase of `count` flat steps. */
export const steps = (count: number): Easing => {
  const n = Math.max(1, Math.floor(count))
  return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.floor(t * n) / n)
}

export const none: Easing = (t) => t

/**
 * Register every named family into @underlying/core so string eases resolve
 * ('power2.out', 'back.inOut(2)', 'elastic.out(1, 0.3)', 'steps(5)'). Called by
 * the '@underlying/utils/register' entry; importing it is the opt-in.
 */
export function registerEases(): void {
  const fixed: Record<string, EaseFamily> = {
    power1,
    power2,
    power3,
    power4,
    quad,
    cubic,
    quart,
    quint,
    sine,
    expo,
    circ,
    bounce,
  }
  for (const [name, family] of Object.entries(fixed)) {
    registerEasing(name, (variant: EasingVariant) => family[variant])
  }
  registerEasing('back', (variant, params) => back(params[0])[variant])
  registerEasing('elastic', (variant, params) => elastic(params[0], params[1])[variant])
  registerEasing('steps', (_variant, params) => steps(params[0] ?? 1))
  registerEasing('linear', () => none)
  registerEasing('none', () => none)
}
