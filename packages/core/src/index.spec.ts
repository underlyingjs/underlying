import { describe, expect, it } from 'vitest'
import { VERSION } from './index'

describe('@underlying/core', () => {
  it('exposes the package version', () => {
    expect(VERSION).toBe('0.0.0')
  })
})
