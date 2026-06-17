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

  it('rejects arc paths', () => {
    const { el } = fakeEl('M0 0 L10 0 Z')
    expect(() => morphCommands(el, 'M0 0 A5 5 0 0 1 10 10')).toThrow(/arcs/)
  })

  it('holds the original shape for a degenerate (empty) target, never blanking it', () => {
    const { el, state } = fakeEl('M0 0 L10 0 L10 10 Z')
    morphCommands(el, '') // target parses to nothing
    expect(state.d).toMatch(/^M 0 0 C/) // still the original, as cubics - not the empty string
    expect(state.d).toContain('10')
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
