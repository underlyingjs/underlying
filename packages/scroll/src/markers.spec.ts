import { describe, expect, it } from 'vitest'
import { markerGeometry } from './markers'
import { offsetEdges } from './range'

describe('offsetEdges', () => {
  it('splits an edge pair into element and viewport fractions', () => {
    expect(offsetEdges('start end')).toEqual({ elem: 0, viewport: 1 })
    expect(offsetEdges('center center')).toEqual({ elem: 0.5, viewport: 0.5 })
    expect(offsetEdges('end start')).toEqual({ elem: 1, viewport: 0 })
    expect(offsetEdges('top bottom')).toEqual({ elem: 0, viewport: 1 })
  })

  it('returns null for numeric / % / px offsets (a position, not an edge pair)', () => {
    expect(offsetEdges(0.5)).toBeNull()
    expect(offsetEdges('40%')).toBeNull()
    expect(offsetEdges('120px')).toBeNull()
  })
})

describe('markerGeometry', () => {
  const box = { start: 800, size: 200 }

  it('content lines at the element edges, viewport lines at the crossing fractions', () => {
    const geo = markerGeometry(box, 1000, ['start end', 'end start'])
    expect(geo.enter).toEqual({ content: 800, viewport: 1 }) // start edge, fires at the viewport's far edge
    expect(geo.leave).toEqual({ content: 1000, viewport: 0 }) // end edge, fires at the viewport's near edge
  })

  it('center alignment lands the element midpoint at the viewport midpoint', () => {
    const geo = markerGeometry(box, 1000, ['center center', 'center center'])
    expect(geo.enter).toEqual({ content: 900, viewport: 0.5 })
  })

  it('a numeric offset yields a content line only (no viewport line)', () => {
    const geo = markerGeometry(box, 1000, [0, 1])
    expect(geo.enter.viewport).toBeNull()
    expect(geo.leave.viewport).toBeNull()
    expect(geo.enter.content).toBeCloseTo(-200) // box.start - viewport
    expect(geo.leave.content).toBeCloseTo(1000) // box.start - viewport + (viewport + size)
  })
})
