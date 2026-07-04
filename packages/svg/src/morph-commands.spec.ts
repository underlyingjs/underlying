import { createScheduler } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { describe, expect, it } from 'vitest'
import type { MorphElement } from './morph'
import { morphCommands } from './morph-commands'

// A minimal path element: only the `d` attribute is read/written by the command
// morph (the geometry methods are never called - it parses `d`, not arc length).
function fakeEl(d: string): { el: MorphElement; state: { d: string } } {
  const state = { d }
  const el = {
    getAttribute: (name: string) => (name === 'd' ? state.d : null),
    setAttribute: (name: string, value: string) => {
      if (name === 'd') state.d = value
    },
    getTotalLength: () => 0,
    getPointAtLength: () => ({ x: 0, y: 0 }),
  }
  return { el: el as unknown as MorphElement, state }
}

describe('morphCommands', () => {
  it('writes cubic commands and scrubs from the original to the target', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const { el, state } = fakeEl('M0 0 L10 0 L10 10 Z')
    const m = morphCommands(el, 'M0 0 L20 0 L20 20 Z', { scheduler })

    expect(state.d).toMatch(/^M 0 0 C/) // emitted as real cubics
    expect(state.d).toContain('10') // the original square's anchors at fraction 0

    m.fraction.set(1)
    driver.frame(0)
    driver.frame(16)
    expect(state.d).toContain('20') // the target square's anchors at fraction 1

    m.revert()
    expect(state.d).toBe('M0 0 L10 0 L10 10 Z') // original d restored verbatim
  })

  it('subdivides the sparser shape so a triangle can morph into a pentagon', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const { el, state } = fakeEl('M0 0 L10 0 L5 10 Z') // 3 segments
    morphCommands(el, 'M0 0 L10 0 L12 6 L6 12 L0 6 Z', { scheduler }) // 5 segments

    // the written shape has been reconciled to 5 cubic segments (the pentagon count)
    const cubics = (state.d.match(/C/g) ?? []).length
    expect(cubics).toBe(5)
  })

  it('morphs into an arc path (arcs convert to cubics, no throw)', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const { el, state } = fakeEl('M0 0 L10 0 L10 10 Z')
    const m = morphCommands(el, 'M0 0 A5 5 0 0 1 10 10', { scheduler })
    expect(state.d).toMatch(/^M 0 0 C/)
    m.fraction.set(1)
    driver.frame(0)
    driver.frame(16)
    expect(state.d).toContain('10') // reached the arc endpoint, cubic-emitted
  })

  it('holds the original shape for a degenerate (empty) target, never blanking it', () => {
    const { el, state } = fakeEl('M0 0 L10 0 L10 10 Z')
    morphCommands(el, '') // target parses to nothing
    expect(state.d).toMatch(/^M 0 0 C/) // still the original, as cubics - not the empty string
    expect(state.d).toContain('10')
  })

  it('grows a surplus target subpath in from a point (source has fewer pieces)', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const { el, state } = fakeEl('M0 0 L10 0 L10 10 Z') // 1 subpath
    const m = morphCommands(el, 'M0 0 L10 0 L10 10 Z M50 50 L60 50 L60 60 Z', { scheduler }) // 2 subpaths

    // At f=0 the not-yet-grown piece emits nothing (no stroked dot; f=0 = the source).
    expect((state.d.match(/M /g) ?? []).length).toBe(1)
    m.fraction.set(1)
    driver.frame(0)
    driver.frame(16)
    expect((state.d.match(/M /g) ?? []).length).toBe(2) // grown in by f=1
    expect(state.d).toContain('50') // the grown-in second piece reaches its target
  })

  it('pairs pieces by similarity, not authoring order (a piece stays near home mid-morph)', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    // Source: left piece then right piece. Target: SAME two pieces authored right-first.
    const { el, state } = fakeEl('M0 0 L20 0 L20 20 Z M200 0 L220 0 L220 20 Z')
    const m = morphCommands(el, 'M200 0 L220 0 L220 20 Z M0 0 L20 0 L20 20 Z', { scheduler })
    m.fraction.set(0.5)
    driver.frame(0)
    driver.frame(16)
    // With similarity pairing the left piece morphs to the left target (stays left),
    // so the mid-morph still has geometry near x~0 and near x~200 - not both collapsed
    // to the middle (~110) that index-pairing's cross-match would produce.
    const xs = (state.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).filter((_, i) => i % 2 === 0)
    expect(Math.min(...xs)).toBeLessThan(60) // still a piece near the left
    expect(Math.max(...xs)).toBeGreaterThan(160) // still a piece near the right
  })

  it('tolerates a stray leading M in the target without crashing', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const { el } = fakeEl('M0 0 L10 0')
    expect(() => {
      const m = morphCommands(el, 'M99 99 M50 50 L60 50', { scheduler })
      m.fraction.set(1)
      driver.frame(0)
      driver.frame(16)
    }).not.toThrow()
  })
})
