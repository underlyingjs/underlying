import { describe, expect, it, vi } from 'vitest'
import { registerEasing, resolveEasing } from './easing-registry'
import { linear } from './easings'

describe('easing registry', () => {
  it('passes a function through untouched', () => {
    expect(resolveEasing(linear)).toBe(linear)
  })

  it('resolves a registered family with variant and numeric params', () => {
    const seen: Array<[string, ReadonlyArray<number>]> = []
    registerEasing('famParams', (variant, params) => {
      seen.push([variant, params])
      return (p) => p
    })

    const ease = resolveEasing('famParams.inOut(1, 0.3)')
    expect(typeof ease).toBe('function')
    expect(seen[0]).toEqual(['inOut', [1, 0.3]])
  })

  it('defaults the variant to out (by convention) when none is given', () => {
    registerEasing('famVariant', (variant) => (variant === 'out' ? () => 1 : () => 0))
    expect(resolveEasing('famVariant')(0.5)).toBe(1) // .out
    expect(resolveEasing('famVariant.in')(0.5)).toBe(0)
  })

  it('parses a numeric suffix in the family name (power2) and no-variant params (steps(4))', () => {
    let powerName = ''
    let stepsParams: ReadonlyArray<number> = []
    registerEasing('power2', (_v, _p) => {
      powerName = 'power2'
      return (p) => p
    })
    registerEasing('steps', (_v, params) => {
      stepsParams = params
      return (p) => p
    })
    resolveEasing('power2.out')
    resolveEasing('steps(4)')
    expect(powerName).toBe('power2')
    expect(stepsParams).toEqual([4])
  })

  it('warns once and falls back for an unknown name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ease = resolveEasing('totallyUnknown.out')
    expect(typeof ease).toBe('function') // easeInOutCubic fallback, never throws
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
