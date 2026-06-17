import { describe, expect, it } from 'vitest'
import { align, lerpSubpath, parsePath, reconcile, subpathToD } from './path-commands'

describe('parsePath', () => {
  it('turns lines and Z into cubic segments, keeping the anchors', () => {
    const sp = parsePath('M0 0 L10 0 L10 10 Z')
    expect(sp).toHaveLength(1)
    const s = sp[0]!
    expect(s.closed).toBe(true)
    expect(s.start).toEqual({ x: 0, y: 0 })
    expect(s.segments).toHaveLength(3) // two lines + the closing line
    expect(s.segments[0]!.end).toEqual({ x: 10, y: 0 }) // anchor preserved
    expect(s.segments[2]!.end).toEqual({ x: 0, y: 0 }) // Z returns to start
    // a line's controls sit at the thirds, so it stays straight
    expect(s.segments[0]!.c1).toEqual({ x: 10 / 3, y: 0 })
  })

  it('reads cubic commands directly', () => {
    const s = parsePath('M0 0 C1 2 3 4 5 6')[0]!
    expect(s.segments[0]).toEqual({ c1: { x: 1, y: 2 }, c2: { x: 3, y: 4 }, end: { x: 5, y: 6 } })
  })

  it('resolves relative commands to absolute', () => {
    const s = parsePath('M10 10 l5 0 l0 5')[0]!
    expect(s.segments[0]!.end).toEqual({ x: 15, y: 10 })
    expect(s.segments[1]!.end).toEqual({ x: 15, y: 15 })
  })

  it('elevates a quadratic to a cubic', () => {
    const s = parsePath('M0 0 Q6 0 6 6')[0]!
    // exact degree elevation: c1 = from + 2/3(ctrl-from), c2 = end + 2/3(ctrl-end)
    expect(s.segments[0]!.c1).toEqual({ x: 4, y: 0 })
    expect(s.segments[0]!.c2).toEqual({ x: 6, y: 2 })
  })

  it('rejects arcs (use the resampling morph for those)', () => {
    expect(() => parsePath('M0 0 A5 5 0 0 1 10 10')).toThrow(/arcs/)
  })

  it('continues a new subpath when a command follows Z without an explicit M', () => {
    const sp = parsePath('M10 10 L20 10 L20 20 Z L30 30 L30 10 Z')
    expect(sp).toHaveLength(2) // the trailing leg is its own subpath, not dropped
    expect(sp[1]!.start).toEqual({ x: 10, y: 10 }) // begins at the just-closed start
  })

  it('drops empty moveto-only legs (a lone or duplicate M)', () => {
    const sp = parsePath('M0 0 M10 10 L20 10')
    expect(sp).toHaveLength(1) // the empty M0 0 is a no-op
    expect(sp[0]!.start).toEqual({ x: 10, y: 10 })
  })
})

describe('reconcile + interpolate', () => {
  it('brings both shapes to the same segment count by splitting the longer chords', () => {
    const [ra, rb] = reconcile(parsePath('M0 0 L10 0')[0]!, parsePath('M0 0 L5 0 L10 0')[0]!)
    expect(ra.segments).toHaveLength(2)
    expect(rb.segments).toHaveLength(2)
    expect(ra.segments[0]!.end.x).toBeCloseTo(5) // the single line split at its middle
    expect(ra.segments[1]!.end.x).toBeCloseTo(10) // original endpoint preserved
  })

  it('lerps anchors and controls between two reconciled subpaths', () => {
    const a = parsePath('M0 0 L10 0')[0]!
    const b = parsePath('M0 0 L10 10')[0]!
    expect(lerpSubpath(a, b, 0).segments[0]!.end).toEqual({ x: 10, y: 0 })
    expect(lerpSubpath(a, b, 1).segments[0]!.end).toEqual({ x: 10, y: 10 })
    expect(lerpSubpath(a, b, 0.5).segments[0]!.end).toEqual({ x: 10, y: 5 })
  })

  it('round-trips a cubic through emit', () => {
    const s = parsePath('M0 0 C1 2 3 4 5 6')[0]!
    expect(subpathToD(s)).toBe('M 0 0 C 1 2 3 4 5 6')
  })

  it('align rotates a closed ring to the nearest matching start', () => {
    const from = parsePath('M0 0 L10 0 L10 10 L0 10 Z')[0]! // square, starts at (0,0)
    const to = parsePath('M10 10 L0 10 L0 0 L10 0 Z')[0]! // same square, start shifted two corners
    const [ra, rb] = reconcile(from, to)
    const aligned = align(ra, rb)
    expect(aligned.start.x).toBeCloseTo(0) // rotated so its start lands back on (0,0)
    expect(aligned.start.y).toBeCloseTo(0)
  })
})
