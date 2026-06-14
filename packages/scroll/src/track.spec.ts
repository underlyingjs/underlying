import { describe, expect, it, vi } from 'vitest'
import { createManualScrollSource } from './source-manual'
import { createTrack } from './track'

const el = {} as HTMLElement

describe('createTrack', () => {
  it('maps the injected box + scroll position to clamped/raw progress', () => {
    const source = createManualScrollSource({ viewportSize: 1000, maxScroll: 2000 })
    source.setBox(el, { start: 1000, size: 500 }) // default range -> enter 0, leave 1500
    const track = createTrack(source, { target: el })

    source.emitScroll(750)
    expect(track.progress()).toBe(0.5)
    expect(track.raw()).toBe(0.5)

    source.emitScroll(0)
    expect(track.raw()).toBeCloseTo(-0.0, 6)
    source.emitScroll(-300)
    expect(track.raw()).toBeCloseTo(-0.2, 6)
    expect(track.progress()).toBe(0) // clamped

    source.emitScroll(3000)
    expect(track.raw()).toBe(2)
    expect(track.progress()).toBe(1) // clamped
  })

  it('notifies on() only when the clamped value actually moves', () => {
    const source = createManualScrollSource({ viewportSize: 1000, maxScroll: 2000 })
    source.setBox(el, { start: 1000, size: 500 })
    const track = createTrack(source, { target: el })
    const seen = vi.fn()
    track.on(seen)

    source.emitScroll(750)
    track.sample()
    expect(seen).toHaveBeenLastCalledWith(0.5)

    track.sample() // same scroll position -> deduped
    expect(seen).toHaveBeenCalledTimes(1)

    source.emitScroll(1500)
    track.sample()
    expect(seen).toHaveBeenLastCalledWith(1)
    expect(seen).toHaveBeenCalledTimes(2)
  })

  it('a track with no target spans the whole scroller (0..maxScroll)', () => {
    const source = createManualScrollSource({ viewportSize: 800, maxScroll: 2000 })
    const track = createTrack(source)
    source.emitScroll(1000)
    expect(track.progress()).toBe(0.5)
  })

  it('refresh() re-measures after the box moves', () => {
    const source = createManualScrollSource({ viewportSize: 1000, maxScroll: 2000 })
    source.setBox(el, { start: 1000, size: 500 })
    const track = createTrack(source, { target: el })
    source.emitScroll(750)
    expect(track.progress()).toBe(0.5)

    source.setBox(el, { start: 0, size: 500 }) // moved up; range now enter -1000, leave 500
    track.refresh()
    // at scrollPos 750: raw = (750 - -1000) / (500 - -1000) = 1750/1500 -> clamped 1
    expect(track.progress()).toBe(1)
  })
})
