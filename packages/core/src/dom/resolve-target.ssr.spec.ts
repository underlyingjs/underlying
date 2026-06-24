// Runs in the default (node) environment: no document, the SSR path.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetWarnings } from '../value/warn'
import { resolveTargets } from './resolve-target'

afterEach(() => {
  __resetWarnings()
  vi.restoreAllMocks()
})

describe('resolveTargets (SSR)', () => {
  it('resolves a selector to [] without throwing when there is no document', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(typeof document).toBe('undefined')
    expect(() => resolveTargets('.anything')).not.toThrow()
    expect(resolveTargets('.anything')).toEqual([])
  })
})
