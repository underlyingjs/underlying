// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetWarnings } from '../value/warn'
import { resolveTargets } from './resolve-target'

afterEach(() => {
  document.body.innerHTML = ''
  __resetWarnings()
})

describe('resolveTargets', () => {
  it('returns a single element unchanged', () => {
    const el = document.createElement('div')
    expect(resolveTargets(el)).toEqual([el])
  })

  it('resolves a selector, keeping HTML and SVG elements', () => {
    document.body.innerHTML =
      '<div class="t"></div><div class="t"></div><svg class="t"></svg>'
    const found = resolveTargets('.t')
    expect(found).toHaveLength(3) // SVG is animatable too (attr:viewBox/r/points)
    expect(found.every((node) => node instanceof HTMLElement || node instanceof SVGElement)).toBe(true)
  })

  it('resolves a NodeList', () => {
    document.body.innerHTML = '<p class="n"></p><p class="n"></p>'
    const found = resolveTargets(document.querySelectorAll('.n'))
    expect(found).toHaveLength(2)
  })

  it('resolves a plain array of elements', () => {
    const a = document.createElement('div')
    const b = document.createElement('div')
    expect(resolveTargets([a, b])).toEqual([a, b])
  })

  it('warns once when a selector matches nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveTargets('.nope')).toEqual([])
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('honors an explicit root', () => {
    const root = document.createElement('div')
    root.innerHTML = '<span class="scoped"></span>'
    document.body.innerHTML = '<span class="scoped"></span>'
    expect(resolveTargets('.scoped', root)).toHaveLength(1) // only the one inside root
  })
})
