// Runs in the default (node) environment: no DOM, the SSR path.
import { describe, expect, it } from 'vitest'
import { region } from './region'

describe('region (SSR)', () => {
  it('runs setup, keeps responsive inert, and revert() is safe', () => {
    const order: string[] = []
    const r = region((scope) => {
      scope.add(() => order.push('cleanup'))
      scope.responsive('(min-width: 768px)', () => {
        order.push('up')
      })
    })
    expect(order).toEqual([]) // responsive setup never runs server-side
    expect(() => r.revert()).not.toThrow()
    expect(order).toEqual(['cleanup'])
  })
})
