import { getSharedScheduler, type Scheduler } from '@underlying/core'
import { graphemes } from './segment'
import { runTextEffect, type TextEffect } from './effect'

export interface ScrambleOptions {
  /** Total time (ms). Default 1400. */
  duration?: number
  /** Pool of glyphs to cycle through for not-yet-decoded positions. */
  chars?: string
  locale?: string
  scheduler?: Scheduler
}

const POOL = '!<>-_\\/[]{}=+*^?#abcdef0123456789'

/**
 * Decode `text` into `element`: positions reveal left to right while the rest
 * cycle random glyphs, settling on the target. The final text is the accessible
 * name throughout (the scrambling is aria-hidden).
 */
export function scramble(element: HTMLElement, text: string, options: ScrambleOptions = {}): TextEffect {
  const duration = options.duration ?? 1400
  const pool = options.chars ?? POOL
  const scheduler = options.scheduler ?? getSharedScheduler()
  const target = graphemes(text, options.locale)
  const randomGlyph = (): string => pool[Math.floor(Math.random() * pool.length)] ?? ''

  return runTextEffect(element, text, duration, scheduler, (progress) => {
    const revealed = Math.floor(progress * target.length)
    let out = ''
    for (let i = 0; i < target.length; i++) {
      const glyph = target[i]!
      out += i < revealed || /\s/.test(glyph) ? glyph : randomGlyph()
    }
    return out
  })
}
