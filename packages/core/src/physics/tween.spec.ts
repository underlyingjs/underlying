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
