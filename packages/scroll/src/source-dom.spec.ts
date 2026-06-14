// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createDomScrollSource } from './source-dom'

describe('DOM scroll source', () => {
  it('caches and fans out scroll on an element scroller', () => {
    const scroller = document.createElement('div')
    document.body.appendChild(scroller)
    const source = createDomScrollSource({ scroller })
    let fired = 0
    source.onScroll(() => {
      fired += 1
    })

    scroller.scrollTop = 120
    scroller.dispatchEvent(new Event('scroll'))
    expect(source.scrollPos()).toBe(120)
    expect(fired).toBe(1)

    source.dispose()
    scroller.scrollTop = 200
    scroller.dispatchEvent(new Event('scroll'))
    expect(fired).toBe(1) // detached after dispose
  })

  it('measures an element into a {start,size} box', () => {
    const source = createDomScrollSource() // viewport
    const el = document.createElement('div')
    document.body.appendChild(el)
    const box = source.measure(el)
    expect(typeof box.start).toBe('number')
    expect(typeof box.size).toBe('number')
    source.dispose()
  })
})
