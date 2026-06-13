import { describe, expect, it } from 'vitest'
import * as core from './index'
import { colorValueType, complexValueType, lengthValueType, numberValueType, registerValueType } from './index'

// This spec runs in the default node environment: no document, no window. A
// bare import of the entry must not touch any browser global, and the pure
// parsers must work server-side. Named colors (which need an in-document probe)
// return null rather than throwing.
describe('SSR import safety', () => {
  it('runs in a DOM-less environment', () => {
    expect(typeof document).toBe('undefined')
    expect(typeof window).toBe('undefined')
  })

  it('exposes the full surface without touching a browser global at import', () => {
    expect(typeof core.animate).toBe('function')
    expect(typeof core.setStyle).toBe('function')
    expect(typeof core.releaseStyle).toBe('function')
    expect(typeof core.registerValueType).toBe('function')
  })

  it('decomposes values with the pure parsers, no DOM required', () => {
    expect(lengthValueType.parse('50%')).toEqual({ channels: [50], shape: '%' })
    expect(numberValueType.parse('1.5')).toEqual({ channels: [1.5], shape: '' })
    expect(colorValueType.parse('#ff0000')?.channels).toEqual([65025, 0, 0, 1])
    expect(colorValueType.parse('rgb(16, 185, 129)')?.channels).toEqual([256, 34225, 16641, 1])
    expect(complexValueType.parse('0px 4px 8px rgba(0, 0, 0, 0.5)')?.channels).toEqual([0, 4, 8, 0, 0, 0, 0.5])
  })

  it('returns null for named colors without a document instead of throwing', () => {
    expect(colorValueType.parse('rebeccapurple')).toBeNull()
  })

  it('registers a value type without a DOM', () => {
    expect(() => registerValueType(['--ssr-progress'], numberValueType)).not.toThrow()
  })
})
