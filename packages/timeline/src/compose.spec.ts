import { animatable, linear } from '@underlying/core'
import { describe, expect, it } from 'vitest'
import { createTimeline } from './timeline'

const lin = { easing: linear }

describe('timeline - nesting', () => {
  it('nests a timeline as a child and fans seek into it', () => {
    const x = animatable(0)
    const y = animatable(0)
    const inner = createTimeline().to(y, 50, { duration: 500, ...lin })
    const outer = createTimeline()
      .to(x, 100, { at: 0, duration: 1000, ...lin })
      .add(inner, 200)

    expect(outer.duration()).toBe(1000) // x ends at 1000; inner ends at 200+500=700

    outer.seek(450) // inner offset 250 -> halfway
    expect(y.get()).toBeCloseTo(25)
    expect(x.get()).toBeCloseTo(45)

    outer.seek(700)
    expect(y.get()).toBeCloseTo(50) // inner finished
  })
})

describe('timeline - scrub contract', () => {
  it('is a seekable PlaybackHandle whose progress() drives children', () => {
    const x = animatable(0)
    const tl = createTimeline().to(x, 100, { duration: 1000, ...lin })
    // exactly what @underlying/scroll's locked scrub needs:
    expect(tl.seekable).toBe(true)
    expect(typeof tl.duration()).toBe('number')
    tl.progress(0.5)
    expect(x.get()).toBeCloseTo(50)
    tl.progress(0) // reversible
    expect(x.get()).toBeCloseTo(0)
  })
})

describe('timeline - SSR safety', () => {
  it('builds and seeks with no DOM present', () => {
    expect('window' in globalThis).toBe(false)
    const x = animatable(0)
    const tl = createTimeline().to(x, 100, { duration: 500, ...lin }).spring(x, 200, { stiffness: 120, damping: 22 })
    expect(() => tl.seek(250)).not.toThrow()
    expect(x.get()).toBeCloseTo(50)
    expect(typeof tl.duration()).toBe('number')
  })
})
