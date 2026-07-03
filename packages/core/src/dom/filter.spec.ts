import { describe, expect, it } from 'vitest'
import { filter } from './filter'

describe('filter()', () => {
  it('builds a filter string with natural units', () => {
    expect(filter({ blur: 8 })).toBe('blur(8px)')
    expect(filter({ hueRotate: 90 })).toBe('hue-rotate(90deg)')
    expect(filter({ brightness: 1.2, saturate: 1.4 })).toBe('brightness(1.2) saturate(1.4)')
  })

  it('emits functions in a fixed canonical order regardless of key order', () => {
    const a = filter({ saturate: 1.4, blur: 4, brightness: 1.1 })
    const b = filter({ blur: 4, brightness: 1.1, saturate: 1.4 })
    expect(a).toBe(b) // stable order => two results are interpolable
    expect(a).toBe('blur(4px) brightness(1.1) saturate(1.4)')
  })

  it('passes a drop-shadow through verbatim', () => {
    expect(filter({ dropShadow: '0 2px 6px rgba(0,0,0,0.4)' })).toBe('drop-shadow(0 2px 6px rgba(0,0,0,0.4))')
  })

  it('is `none` for an empty spec', () => {
    expect(filter({})).toBe('none')
  })
})
