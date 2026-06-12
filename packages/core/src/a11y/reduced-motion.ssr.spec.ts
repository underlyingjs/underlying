import { afterEach, describe, expect, it } from 'vitest'
import {
  __resetReducedMotion,
  onReducedMotionChange,
  prefersReducedMotion,
  setReducedMotionOverride,
} from './reduced-motion'

afterEach(() => {
  __resetReducedMotion()
})

describe('prefersReducedMotion (SSR)', () => {
  it('is false without a DOM and never throws', () => {
    expect(prefersReducedMotion()).toBe(false)
  })

  it('the override works without a DOM', () => {
    setReducedMotionOverride(true)
    expect(prefersReducedMotion()).toBe(true)
  })

  it('subscriptions are inert without a DOM', () => {
    const unsubscribe = onReducedMotionChange(() => {})
    expect(() => unsubscribe()).not.toThrow()
  })
})
