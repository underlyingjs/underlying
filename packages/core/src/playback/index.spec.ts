import { describe, expect, it } from 'vitest'
import { animatePlayback, follow, playable, sequence, timeScope } from './index'

describe('@underlying/core/playback public surface', () => {
  it('exposes the playback API as functions', () => {
    for (const exported of [playable, animatePlayback, follow, sequence, timeScope]) {
      expect(typeof exported).toBe('function')
    }
  })
})
