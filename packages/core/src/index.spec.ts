import { describe, expect, it } from 'vitest'
import {
  animatable,
  animate,
  bindStyle,
  createScheduler,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  getReducedMotionBehavior,
  linear,
  onReducedMotionChange,
  prefersReducedMotion,
  sequence,
  setReducedMotionBehavior,
  setReducedMotionOverride,
  stagger,
} from './index'

describe('@underlying/core public surface', () => {
  it('exposes the documented API', () => {
    const surface = [
      animatable,
      animate,
      bindStyle,
      createScheduler,
      easeInCubic,
      easeInOutCubic,
      easeOutCubic,
      getReducedMotionBehavior,
      linear,
      onReducedMotionChange,
      prefersReducedMotion,
      sequence,
      setReducedMotionBehavior,
      setReducedMotionOverride,
      stagger,
    ]
    for (const exported of surface) expect(typeof exported).toBe('function')
  })

  it('does not expose a VERSION export (removed at the M10 API review)', async () => {
    const surface = await import('./index')
    expect('VERSION' in surface).toBe(false)
  })
})
