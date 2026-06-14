import { describe, expect, it } from 'vitest'
import { graphemes } from './segment'

describe('graphemes', () => {
  it('splits ascii into single characters', () => {
    expect(graphemes('abc')).toEqual(['a', 'b', 'c'])
  })

  it('keeps a surrogate-pair emoji as one piece', () => {
    expect(graphemes('a😀b')).toEqual(['a', '😀', 'b'])
  })

  it('keeps a ZWJ emoji sequence whole (not shattered into fragments)', () => {
    const family = '👩‍👩‍👧'
    expect(graphemes(`x${family}y`)).toEqual(['x', family, 'y'])
  })
})
