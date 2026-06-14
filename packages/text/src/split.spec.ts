// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { split } from './split'

describe('split', () => {
  it('splits into words, keeps a readable copy, hides the pieces, and reverts losslessly', () => {
    const el = document.createElement('h1')
    el.textContent = 'Hello world'

    const s = split(el)
    expect(s.words.map((w) => w.textContent)).toEqual(['Hello', 'world'])

    // children[0] = visually-hidden readable copy (a11y + copy/paste); children[1] = the aria-hidden pieces
    expect(el.children.length).toBe(2)
    expect(el.children[0]!.textContent).toBe('Hello world')
    expect(el.children[1]!.getAttribute('aria-hidden')).toBe('true')

    s.revert()
    expect(el.innerHTML).toBe('Hello world')
    expect(el.querySelector('.u-text')).toBeNull()
  })

  it('splits into graphemes, leaving spaces as un-wrapped text', () => {
    const el = document.createElement('div')
    el.textContent = 'Hi 😀'
    const s = split(el, { type: ['chars'] })
    expect(s.chars.map((c) => c.textContent)).toEqual(['H', 'i', '😀'])
  })

  it('a11y "label" mode sets and reverts aria-label', () => {
    const el = document.createElement('div')
    el.textContent = 'Save'
    const s = split(el, { a11y: 'label' })
    expect(el.getAttribute('aria-label')).toBe('Save')
    s.revert()
    expect(el.getAttribute('aria-label')).toBeNull()
  })
})
