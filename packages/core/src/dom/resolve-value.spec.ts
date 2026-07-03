import { describe, expect, it, vi } from 'vitest'
import { __resetWarnings } from '../value/warn'
import { needsResolve, resolveValue, type ResolveContext } from './resolve-value'

const el = {} as HTMLElement

const ctx = (over: Partial<ResolveContext> = {}): ResolveContext => ({
  index: 0,
  element: el,
  total: 1,
  readNumeric: () => undefined,
  readMagnitude: () => undefined,
  ...over,
})

describe('needsResolve', () => {
  it('flags functions and relative strings, including inside keyframes', () => {
    expect(needsResolve(() => 1)).toBe(true)
    expect(needsResolve('+=100')).toBe(true)
    expect(needsResolve('-=40')).toBe(true)
    expect(needsResolve('*=2')).toBe(true)
    expect(needsResolve(['+=10', '+=20'])).toBe(true)
    expect(needsResolve(100)).toBe(false)
    expect(needsResolve('100px')).toBe(false)
    expect(needsResolve([0, 100])).toBe(false)
  })
})

describe('resolveValue', () => {
  it('evaluates a function with (index, element, total)', () => {
    const fn = vi.fn((i: number, _e: Element, n: number) => i * 10 + n)
    expect(resolveValue('rotate', fn, ctx({ index: 2, total: 5 }))).toBe(25)
    expect(fn).toHaveBeenCalledWith(2, el, 5)
  })

  it('resolves a numeric relative against the live channel value', () => {
    const c = ctx({ readNumeric: () => 50 })
    expect(resolveValue('x', '+=100', c)).toBe(150)
    expect(resolveValue('x', '-=40', c)).toBe(10)
    expect(resolveValue('x', '*=2', c)).toBe(100)
  })

  it('resolves a registry-property relative against the magnitude, preserving the unit', () => {
    const c = ctx({ readMagnitude: () => ({ value: 100, reformat: (n) => `${n}px` }) })
    expect(resolveValue('width', '+=40px', c)).toBe('140px')
    expect(resolveValue('width', '*=2', c)).toBe('200px')
  })

  it('a non-decomposable relative degrades to the operand and warns once', () => {
    __resetWarnings()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveValue('backgroundColor', '+=10', ctx())).toBe(10)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('chains relative keyframes against the prior resolved waypoint', () => {
    const c = ctx({ readNumeric: () => 0 })
    expect(resolveValue('x', ['+=10', '+=20'], c)).toEqual([10, 30])
  })

  it('a function may return a relative string, which is then resolved', () => {
    const c = ctx({ readNumeric: () => 10 })
    expect(resolveValue('x', () => '+=5', c)).toBe(15)
  })

  it('chains relative keyframes on a registry magnitude, preserving the unit', () => {
    const c = ctx({ readMagnitude: () => ({ value: 100, reformat: (n) => `${n}px` }) })
    expect(resolveValue('width', ['+=10px', '+=20px'], c)).toEqual(['110px', '130px'])
  })

  it('an absolute keyframe re-seeds the chain for a following relative', () => {
    const magCtx = ctx({ readMagnitude: () => ({ value: 100, reformat: (n) => `${n}px` }) })
    expect(resolveValue('width', ['50px', '+=20px'], magCtx)).toEqual(['50px', '70px'])
    const numCtx = ctx({ readNumeric: () => 0 })
    expect(resolveValue('x', ['+=10', 20, '+=5'], numCtx)).toEqual([10, 20, 25]) // 20 re-seeds, +=5 -> 25
  })

  it('leaves absolute scalars and keyframes untouched', () => {
    expect(resolveValue('x', 100, ctx())).toBe(100)
    expect(resolveValue('width', '50%', ctx())).toBe('50%')
    expect(resolveValue('x', [0, 100], ctx())).toEqual([0, 100])
  })

  it('resolves a relative inside a keyframe stop, preserving its position and easing', () => {
    const c = ctx({ readMagnitude: () => ({ value: 100, reformat: (n) => `${n}px` }) })
    expect(resolveValue('width', [{ value: '+=40px', at: 0.5, ease: 'linear' }], c)).toEqual([
      { value: '140px', at: 0.5, ease: 'linear' },
    ])
  })

  it('chains a stop value with a bare waypoint in the same array', () => {
    const c = ctx({ readNumeric: () => 0 })
    // 0 -> {+=10 => 10} -> {+=20 => 30}, metadata on the stops preserved.
    expect(resolveValue('x', ['+=10', { value: '+=20', at: 0.8 }], c)).toEqual([10, { value: 30, at: 0.8 }])
  })

  it('flags a relative inside a keyframe stop via needsResolve', () => {
    expect(needsResolve([0, { value: '+=20' }])).toBe(true)
    expect(needsResolve([0, { value: 100, at: 0.5 }])).toBe(false) // an absolute stop needs no resolution
  })
})
