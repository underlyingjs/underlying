import { describe, expect, it } from 'vitest'
import {
  animatable,
  animate,
  bindStyle,
  bindTemplate,
  colorValueType,
  complexValueType,
  createScheduler,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  getReducedMotionBehavior,
  lengthValueType,
  linear,
  numberValueType,
  onReducedMotionChange,
  prefersReducedMotion,
  chain,
  region,
  registerValueType,
  releaseStyle,
  resolveTargets,
  responsive,
  setReducedMotionBehavior,
  setReducedMotionOverride,
  setStyle,
  stagger,
  staggerDelay,
  staggerDelays,
  template,
} from './index'

describe('@underlying/core public surface', () => {
  it('exposes the documented API', () => {
    const surface = [
      animatable,
      animate,
      bindStyle,
      bindTemplate,
      createScheduler,
      easeInCubic,
      easeInOutCubic,
      easeOutCubic,
      getReducedMotionBehavior,
      linear,
      onReducedMotionChange,
      prefersReducedMotion,
      chain,
      registerValueType,
      releaseStyle,
      region,
      resolveTargets,
      responsive,
      setReducedMotionBehavior,
      setReducedMotionOverride,
      setStyle,
      stagger,
      staggerDelay,
      staggerDelays,
      template,
    ]
    for (const exported of surface) expect(typeof exported).toBe('function')
  })

  it('exposes the built-in value types for composition and re-registration', () => {
    for (const type of [numberValueType, lengthValueType, colorValueType, complexValueType]) {
      expect(typeof type.parse).toBe('function')
      expect(typeof type.format).toBe('function')
      expect(typeof type.channels).toBe('function')
    }
  })

  it('does not expose a VERSION export (removed at the M10 API review)', async () => {
    const surface = await import('./index')
    expect('VERSION' in surface).toBe(false)
  })

  it('keeps the opt-in playback layer and internal seams out of the main entry', async () => {
    const surface = await import('./index')
    for (const name of ['playable', 'animatePlayback', 'follow', 'timeScope', '__getDelegated']) {
      expect(name in surface).toBe(false)
    }
  })
})
