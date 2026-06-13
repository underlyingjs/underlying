import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { colorValueType } from './types/color'
import { complexValueType } from './types/complex'
import { lengthValueType } from './types/length'
import { numberValueType } from './types/number'
import {
  __isSeeded,
  __resetRegistry,
  registerValueType,
  resolveValueType,
} from './registry'
import { __resetWarnings } from './warn'

beforeEach(() => {
  __resetRegistry()
  __resetWarnings()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('registry', () => {
  it('does not seed until the first resolution', () => {
    expect(__isSeeded()).toBe(false)
    resolveValueType('width')
    expect(__isSeeded()).toBe(true)
  })

  it('resolves built-in properties to their value type', () => {
    expect(resolveValueType('width')).toBe(lengthValueType)
    expect(resolveValueType('marginTop')).toBe(lengthValueType)
    expect(resolveValueType('backgroundColor')).toBe(colorValueType)
    expect(resolveValueType('fill')).toBe(colorValueType)
    expect(resolveValueType('flexGrow')).toBe(numberValueType)
  })

  it('falls back to complex for unknown and custom properties', () => {
    expect(resolveValueType('clipPath')).toBe(complexValueType)
    expect(resolveValueType('--progress')).toBe(complexValueType)
  })

  it('warns once for shorthands and resolves them to complex', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveValueType('margin')).toBe(complexValueType)
    expect(resolveValueType('margin')).toBe(complexValueType)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]?.[0]).toContain('shorthand')
  })

  it('lets app code register a value type for a property', () => {
    registerValueType(['--progress'], numberValueType)
    expect(resolveValueType('--progress')).toBe(numberValueType)
  })

  it('warns when re-registering a claimed property and the last registration wins for new groups', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    resolveValueType('width') // seeds width -> length
    registerValueType(['width'], numberValueType)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(resolveValueType('width')).toBe(numberValueType)
  })
})
