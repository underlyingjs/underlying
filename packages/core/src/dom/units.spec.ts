// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { readStyle } from './read-style'
import { createMeasure } from './units'

function makeTree() {
  const parent = document.createElement('div')
  parent.style.width = '480px'
  parent.style.height = '300px'
  const child = document.createElement('div')
  child.style.fontSize = '16px'
  parent.appendChild(child)
  document.body.appendChild(parent)
  document.documentElement.style.fontSize = '10px'
  return { parent, child }
}

afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.style.fontSize = ''
})

describe('createMeasure', () => {
  it('resolves % against the parent inline size for width, block size for height', () => {
    const { child } = makeTree()
    expect(createMeasure(child, 'width', readStyle(child))('%')).toBe(4.8) // 480/100
    expect(createMeasure(child, 'width', readStyle(child))('px')).toBe(1)
    expect(createMeasure(child, 'height', readStyle(child))('%')).toBe(3) // 300/100
    expect(createMeasure(child, 'top', readStyle(child))('%')).toBe(3) // block axis
  })

  it('resolves margins against the inline axis even for vertical margins (per CSS)', () => {
    const { child } = makeTree()
    expect(createMeasure(child, 'marginTop', readStyle(child))('%')).toBe(4.8)
  })

  it('resolves em against the element font-size and rem against the root', () => {
    const { child } = makeTree()
    const measure = createMeasure(child, 'width', readStyle(child))
    expect(measure('em')).toBe(16)
    expect(measure('rem')).toBe(10)
  })

  it('resolves viewport units against the document client box', () => {
    const { child } = makeTree()
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 1000, configurable: true })
    Object.defineProperty(document.documentElement, 'clientHeight', { value: 600, configurable: true })
    const measure = createMeasure(child, 'width', readStyle(child))
    expect(measure('vw')).toBe(10)
    expect(measure('vh')).toBe(6)
    expect(measure('vmin')).toBe(6)
    expect(measure('vmax')).toBe(10)
  })

  it('returns null for an unmeasurable or unknown unit', () => {
    const orphan = document.createElement('div')
    const measure = createMeasure(orphan, 'width', readStyle(orphan))
    expect(measure('%')).toBeNull() // no parent
    expect(measure('ch')).toBeNull() // unsupported unit
  })

  it('memoizes within one context but a fresh context re-reads', () => {
    const { parent, child } = makeTree()
    const first = createMeasure(child, 'width', readStyle(child))
    expect(first('%')).toBe(4.8)
    parent.style.width = '800px'
    expect(first('%')).toBe(4.8) // memoized
    expect(createMeasure(child, 'width', readStyle(child))('%')).toBe(8) // re-read
  })
})
