// Runs in the default (node) environment: no DOM. template() must be pure/inert.
import { describe, expect, it } from 'vitest'
import type { Animatable } from '../value/animatable'
import { template } from './bind-template'

const fakeSource = (value: number): Animatable =>
  ({ get: () => value, on: () => () => {} }) as unknown as Animatable

describe('bind-template (SSR)', () => {
  it('builds a template and formats it with no DOM or browser global', () => {
    const tpl = template`blur(${fakeSource(5)}px) brightness(${fakeSource(2)})`
    expect(tpl.sources).toHaveLength(2)
    expect(() => tpl.format(['5', '2'])).not.toThrow()
    expect(tpl.format(['5', '2'])).toBe('blur(5px) brightness(2)')
  })

  it('folds constants server-side too', () => {
    const tpl = template`brightness(${1.5}) blur(${fakeSource(3)}px)`
    expect(tpl.sources).toHaveLength(1)
    expect(tpl.format(['3'])).toBe('brightness(1.5) blur(3px)')
  })
})
