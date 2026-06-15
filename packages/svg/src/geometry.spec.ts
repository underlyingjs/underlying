import { describe, expect, it } from 'vitest'
import { samplePath, type PathGeometry } from './geometry'

// A unit-speed diagonal: point at arc distance d is (0.6d, 0.8d), so length 100
// runs from (0,0) to (60,80) at a constant tangent of atan2(0.8, 0.6) = 53.13 deg.
const diagonal: PathGeometry = {
  getTotalLength: () => 100,
  getPointAtLength: (d) => ({ x: d * 0.6, y: d * 0.8 }),
}

describe('samplePath', () => {
  it('reports total length and maps t to the point at that arc distance', () => {
    const s = samplePath(diagonal)
    expect(s.length).toBe(100)
    expect(s.at(0)).toMatchObject({ x: 0, y: 0 })
    expect(s.at(0.5)).toMatchObject({ x: 30, y: 40 })
    expect(s.at(1)).toMatchObject({ x: 60, y: 80 })
  })

  it('clamps t to the 0..1 range', () => {
    const s = samplePath(diagonal)
    expect(s.at(-2).x).toBe(0)
    expect(s.at(5).x).toBe(60)
  })

  it('reports the tangent angle in degrees for autoRotate', () => {
    const s = samplePath(diagonal)
    expect(s.at(0.5).angle).toBeCloseTo(53.13, 1)
  })

  it('survives a zero-length path without throwing', () => {
    const point: PathGeometry = { getTotalLength: () => 0, getPointAtLength: () => ({ x: 0, y: 0 }) }
    const s = samplePath(point)
    expect(s.length).toBe(0)
    expect(s.at(0.5)).toMatchObject({ x: 0, y: 0, angle: 0 })
  })
})
