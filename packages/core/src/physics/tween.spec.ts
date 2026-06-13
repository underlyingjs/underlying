import { describe, expect, it } from 'vitest'
import { linear } from './easings'
import { tweenMotion } from './tween'

describe('tweenMotion', () => {
  it('samples the easing curve on the fixed-step clock, with a derived velocity', () => {
    const motion = tweenMotion(0, 120, { duration: 1000, easing: linear })
    let state = { position: 0, velocity: 0 }
    for (let i = 0; i < 60; i++) state = motion.step(state, 1 / 120) // 0,5 s

    expect(state.position).toBeCloseTo(60, 6) // mi-parcours
    expect(state.velocity).toBeCloseTo(120, 6) // 120 unités/s, lisible pour un handoff
    expect(motion.rest(state)).toBeNull()
  })

  it('rests exactly on the target once the duration has elapsed', () => {
    const motion = tweenMotion(0, 100, { duration: 100, easing: linear })
    let state = { position: 0, velocity: 0 }
    for (let i = 0; i < 13; i++) state = motion.step(state, 1 / 120) // 13 * 8,33 ms > 100 ms

    expect(state.position).toBe(100)
    expect(motion.rest(state)).toBe(100)
  })

  it('exposes the total duration in seconds', () => {
    expect(tweenMotion(0, 100, { duration: 1000 }).durationS).toBe(1)
    expect(tweenMotion(0, 100).durationS).toBe(0.3) // 300 ms par défaut
  })

  it('seeks to an absolute elapsed time and samples the curve there', () => {
    const motion = tweenMotion(0, 120, { duration: 1000, easing: linear })

    const mid = motion.seek(0.5)
    expect(mid.position).toBeCloseTo(60, 6)
    expect(mid.velocity).toBeCloseTo(120, 6) // dérivée de la courbe, pas l'historique

    const end = motion.seek(2) // clampé à la durée
    expect(end.position).toBe(120)
    expect(motion.rest(end)).toBe(120)

    const start = motion.seek(-1) // clampé à zéro
    expect(start.position).toBe(0)
  })

  it('continues stepping from wherever a seek left the clock', () => {
    const motion = tweenMotion(0, 100, { duration: 1000, easing: linear })
    motion.seek(0.5)
    const next = motion.step({ position: 50, velocity: 0 }, 1 / 120)

    expect(next.position).toBeGreaterThan(50) // repart de 0,5 s, pas de 0
    expect(next.position).toBeCloseTo(50 + 100 / 120, 6)
  })

  it('treats a zero-duration tween as instantly rested at the target', () => {
    const motion = tweenMotion(0, 80, { duration: 0 })
    const sample = motion.seek(0)
    expect(sample.position).toBe(80)
    expect(sample.velocity).toBe(0)
    expect(motion.rest(sample)).toBe(80)
  })
})

describe('easings', () => {
  it('hits its endpoints exactly', async () => {
    const { linear: lin, easeInCubic, easeOutCubic, easeInOutCubic } = await import('./easings')
    for (const easing of [lin, easeInCubic, easeOutCubic, easeInOutCubic]) {
      expect(easing(0)).toBe(0)
      expect(easing(1)).toBe(1)
    }
    expect(lin(0.25)).toBe(0.25)
    expect(easeInOutCubic(0.5)).toBe(0.5)
  })
})
