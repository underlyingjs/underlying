import { describe, expect, it } from 'vitest'
import { resolveEasing } from '@underlying/core'
import { back, bounce, cubic, elastic, power2, registerEases, sine, steps } from './eases'
import { cubicBezier } from './custom-ease'

describe('eases', () => {
  it('every family hits 0 at 0 and 1 at 1, on all three variants', () => {
    for (const family of [power2, sine, cubic, back(), elastic(), bounce]) {
      for (const variant of ['in', 'out', 'inOut'] as const) {
        expect(family[variant](0)).toBeCloseTo(0, 5)
        expect(family[variant](1)).toBeCloseTo(1, 5)
      }
    }
  })

  it('power2 is cubic (t^3) and its variants reflect correctly', () => {
    expect(power2.in(0.5)).toBeCloseTo(0.125, 5)
    expect(power2.out(0.5)).toBeCloseTo(0.875, 5)
    expect(power2.inOut(0.5)).toBeCloseTo(0.5, 5)
  })

  it('steps makes a flat staircase', () => {
    const s = steps(4)
    expect(s(0)).toBe(0)
    expect(s(0.24)).toBe(0)
    expect(s(0.26)).toBe(0.25)
    expect(s(0.99)).toBe(0.75)
    expect(s(1)).toBe(1)
  })

  it('registerEases() makes string names resolve in core, with params', () => {
    registerEases()
    expect(resolveEasing('power2.out')(0.5)).toBeCloseTo(power2.out(0.5), 5)
    const backed = resolveEasing('back.in(2)')
    expect(backed(0)).toBeCloseTo(0, 5)
    expect(backed(1)).toBeCloseTo(1, 5)
    expect(resolveEasing('steps(4)')(0.26)).toBe(0.25)
  })
})

describe('cubicBezier', () => {
  it('the y = x bezier is the identity', () => {
    expect(cubicBezier(0, 0, 1, 1)(0.5)).toBeCloseTo(0.5, 5)
  })

  it('a symmetric ease-in-out passes 0, 1 and ~0.5 at the midpoint', () => {
    const ease = cubicBezier(0.42, 0, 0.58, 1)
    expect(ease(0)).toBe(0)
    expect(ease(1)).toBe(1)
    expect(ease(0.5)).toBeCloseTo(0.5, 2)
  })
})
