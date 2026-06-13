import { describe, expect, it } from 'vitest'
import {
  animatable,
  animate,
  bindStyle,
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
  registerValueType,
  releaseStyle,
  sequence,
  setReducedMotionBehavior,
  setReducedMotionOverride,
  setStyle,
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
      registerValueType,
      releaseStyle,
      sequence,
      setReducedMotionBehavior,
      setReducedMotionOverride,
      setStyle,
      stagger,
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
