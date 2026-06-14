import {
  animate,
  prefersReducedMotion,
  releaseStyle,
  setStyle,
  stagger,
  type AnimateOptions,
  type Scheduler,
} from '@underlying/core'
import { split, type Split, type SplitA11y, type SplitOptions, type SplitType } from './split'

export interface RevealFrom {
  x?: number
  y?: number
  scale?: number
  opacity?: number
}

export interface RevealOptions {
  /** Which granularity to stagger in. Default 'words'. */
  by?: SplitType
  /** Ms between pieces. Default 40. */
  each?: number
  /** The hidden / offset start state each piece springs from. Default { y: 24, opacity: 0 }. */
  from?: RevealFrom
  /** Per-piece tween duration (ms). Omitted = spring (the default). */
  duration?: number
  stiffness?: number
  damping?: number
  a11y?: SplitA11y
  locale?: string
  scheduler?: Scheduler
}

export interface Reveal {
  /** The underlying split, for the pieces and revert(). */
  readonly split: Split
  /** Resolves when every piece has settled (or on stop). */
  readonly finished: Promise<void>
  stop(): void
  /** Stop, release the per-piece animation state, and restore the original DOM. */
  revert(): void
}

type Channels = Partial<Record<'x' | 'y' | 'scale' | 'opacity', number>>
const DEFAULT_FROM: RevealFrom = { y: 24, opacity: 0 }
const IDENTITY: Record<keyof RevealFrom, number> = { x: 0, y: 0, scale: 1, opacity: 1 }

/**
 * Split an element and stagger its pieces in on springs - overshoot and all,
 * because the reveal is a real spring, not an eased curve. Accessible (the text
 * is read whole) and reduced-motion safe (it shows immediately, no per-piece
 * motion, under prefers-reduced-motion).
 */
export function reveal(element: HTMLElement, options: RevealOptions = {}): Reveal {
  const by = options.by ?? 'words'
  const each = options.each ?? 40
  const from = options.from ?? DEFAULT_FROM

  const splitOptions: SplitOptions = {
    type: by === 'chars' ? ['words', 'chars'] : by === 'lines' ? ['words', 'lines'] : ['words'],
    resize: false,
  }
  if (options.a11y !== undefined) splitOptions.a11y = options.a11y
  if (options.locale !== undefined) splitOptions.locale = options.locale
  const result = split(element, splitOptions)
  const pieces = by === 'chars' ? result.chars : by === 'lines' ? result.lines : result.words

  // Reduced motion: the text is already visible at rest - leave it, no motion.
  if (prefersReducedMotion()) {
    return {
      split: result,
      finished: Promise.resolve(),
      stop() {},
      revert() {
        result.revert()
      },
    }
  }

  const scheduler = options.scheduler
  const keys = (Object.keys(from) as (keyof RevealFrom)[]).filter((key) => from[key] !== undefined)
  const fromTargets: Channels = {}
  const toTargets: Channels = {}
  for (const key of keys) {
    fromTargets[key] = from[key]!
    toTargets[key] = IDENTITY[key]
  }
  // Hide/offset everything up front (on the same scheduler the animation runs on) - no flash.
  const setOptions = scheduler !== undefined ? { scheduler } : {}
  for (const piece of pieces) setStyle(piece, fromTargets, setOptions)

  const animOptions: AnimateOptions = { reducedMotion: 'fade' }
  if (options.duration !== undefined) animOptions.duration = options.duration
  if (options.stiffness !== undefined) animOptions.stiffness = options.stiffness
  if (options.damping !== undefined) animOptions.damping = options.damping
  if (scheduler !== undefined) animOptions.scheduler = scheduler

  const handle = stagger(
    pieces,
    (piece) => animate(piece, toTargets, animOptions),
    each,
    scheduler !== undefined ? { scheduler } : {},
  )

  return {
    split: result,
    finished: handle.finished,
    stop() {
      handle.stop()
    },
    revert() {
      handle.stop()
      for (const piece of pieces) releaseStyle(piece)
      result.revert()
    },
  }
}
