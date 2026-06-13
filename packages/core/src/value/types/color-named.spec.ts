// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { __resetColorProbe, parseColor } from './color'

afterEach(() => {
  __resetColorProbe()
})

describe('named color resolution (jsdom probe)', () => {
  it('does not create a probe element merely by importing the module', () => {
    // No parse has run in this test yet; the probe is lazy.
    const divs = document.documentElement.querySelectorAll('div')
    expect(divs.length).toBe(0)
  })

  it('resolves named colors through a single reused in-document probe', () => {
    expect(parseColor('rebeccapurple')).toEqual([102 * 102, 51 * 51, 153 * 153, 1])
    expect(parseColor('cornflowerblue')).toEqual([100 * 100, 149 * 149, 237 * 237, 1])
    // Both resolutions share one probe element.
    expect(document.documentElement.querySelectorAll('div').length).toBe(1)
  })

  it('returns null for invalid keywords without leaking a wrong color', () => {
    expect(parseColor('notacolor')).toBeNull()
  })

  it('keeps the non-color keywords (currentcolor, none, auto) unparsed', () => {
    expect(parseColor('currentcolor')).toBeNull()
    expect(parseColor('auto')).toBeNull()
    expect(parseColor('inherit')).toBeNull()
  })
})
