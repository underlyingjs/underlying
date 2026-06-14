import { getSharedScheduler, type Scheduler } from '@underlying/core'
import { graphemes } from './segment'
import { runTextEffect, type TextEffect } from './effect'

export interface TypewriterOptions {
  /** Total time (ms). Default scales with length (~55 ms/char, min 400). */
  duration?: number
  locale?: string
  scheduler?: Scheduler
}

/**
 * Type `text` into `element` one grapheme at a time. The full text is the
 * accessible name throughout (the partial text is aria-hidden), so a screen
 * reader reads it once, not character by character.
 */
export function typewriter(element: HTMLElement, text: string, options: TypewriterOptions = {}): TextEffect {
  const target = graphemes(text, options.locale)
  const duration = options.duration ?? Math.max(400, target.length * 55)
  const scheduler = options.scheduler ?? getSharedScheduler()

  return runTextEffect(element, text, duration, scheduler, (progress) =>
    target.slice(0, Math.floor(progress * target.length)).join(''),
  )
}
