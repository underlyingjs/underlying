import {
  animate,
  prefersReducedMotion,
  releaseStyle,
  setStyle,
  stagger,
  type AnimateOptions,
  type AnimationHandle,
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
  /** The hidden / offset start state each piece springs from. Default { y: 24, opacity: 0 } (or {} when masking). */
  from?: RevealFrom
  /** Per-piece tween duration (ms). Omitted = spring (the default). */
  duration?: number
  stiffness?: number
  damping?: number
  a11y?: SplitA11y
  locale?: string
  scheduler?: Scheduler
  /**
   * Wrap each piece in a clip mask so it rises from behind a hard edge. Default false.
   * The clip is a vertical mask (overflow:hidden), so `by: 'lines'` (a full-width block,
   * the canonical headline reveal) is cleanest; `by: 'words'`/`'chars'` shrink-wrap to
   * each piece, so an italic/swash glyph's horizontal overhang can be clipped at the edges.
   */
  mask?: boolean
  /**
   * Re-split lines, re-mask and re-settle on reflow / font load. Default = `mask`
   * (so a masked line reveal stays correct after reflow; a plain reveal stays off
   * and byte-identical to before). Lines only.
   */
  resize?: boolean
  /** Extra px on the BOTTOM of the clip box, for descenders under a tight line-height. Default 0. */
  bleed?: number
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
 * because the reveal is a real spring, not an eased curve. With `mask` each piece
 * rises from behind a hard clip edge (the headline reveal), and a masked line
 * reveal re-splits and re-masks on reflow so the line masks stay correct.
 * Accessible (the text is read whole) and reduced-motion safe (it shows
 * immediately, no clip, no per-piece motion, under prefers-reduced-motion).
 */
export function reveal(element: HTMLElement, options: RevealOptions = {}): Reveal {
  const by = options.by ?? 'words'
  const each = options.each ?? 40
  const mask = options.mask ?? false
  const bleed = options.bleed ?? 0
  const a11y = options.a11y ?? 'copy'
  const block = by === 'lines'
  const reduce = prefersReducedMotion()
  // Masked + no explicit `from` is a pure slide (the edge does the hiding, no fade).
  const from = options.from ?? (mask ? {} : DEFAULT_FROM)

  const scheduler = options.scheduler
  const setOptions = scheduler !== undefined ? { scheduler } : {}

  // The from/to channels. The mask always drives y -> 0 (the rise from the edge).
  const keys = (Object.keys(from) as (keyof RevealFrom)[]).filter((key) => from[key] !== undefined)
  const fromTargets: Channels = {}
  const toTargets: Channels = {}
  for (const key of keys) {
    fromTargets[key] = from[key]!
    toTargets[key] = IDENTITY[key]
  }
  if (mask) toTargets.y = 0

  const animOptions: AnimateOptions = { reducedMotion: 'fade' }
  if (options.duration !== undefined) animOptions.duration = options.duration
  if (options.stiffness !== undefined) animOptions.stiffness = options.stiffness
  if (options.damping !== undefined) animOptions.damping = options.damping
  if (scheduler !== undefined) animOptions.scheduler = scheduler

  // reveal owns its OWN finished promise (stable across a re-split re-arm), and a
  // per-arm token so a stopped arm's settle (stagger.stop() also resolves finished)
  // never flips the real settle flag.
  let resolveFinished: () => void = () => {}
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve
  })
  let handle: AnimationHandle | null = null
  let current: HTMLElement[] = [] // snapshot of the live arm's pieces, for deterministic release
  let settled = false
  let stopped = false
  let armToken = 0

  // Wrap one piece in a clip mask (its new parent in its exact DOM slot). overflow
  // shrink-wraps the box to the piece, so the clip equals the piece box and stays
  // correct through reflow with no JS. vertical-align:top keeps inline wrappers from
  // re-baselining (overflow != visible drops an inline-block to its bottom edge).
  const wrap = (piece: HTMLElement): void => {
    const w = document.createElement('span')
    w.className = 'u-text__mask'
    if (a11y !== 'off') w.setAttribute('aria-hidden', 'true')
    w.style.display = block ? 'block' : 'inline-block'
    w.style.overflow = 'hidden'
    if (!block) w.style.verticalAlign = 'top'
    if (bleed > 0) {
      w.style.paddingBottom = `${bleed}px`
      w.style.marginBottom = `${-bleed}px`
    }
    piece.parentNode?.insertBefore(w, piece)
    w.appendChild(piece)
  }

  // Arm the spring entrance for a set of pieces: wrap (writes), measure offsets in
  // ONE batched read, then write the per-piece hidden start, then stagger the spring.
  const armEntrance = (pieces: HTMLElement[]): AnimationHandle => {
    if (mask) for (const piece of pieces) wrap(piece)
    // offsetHeight is integer-rounded but the clip box is the true fractional height,
    // so + 1 over-hides (the extra is clipped below the edge) - never a sub-px sliver.
    const offsets = mask ? pieces.map((piece) => piece.offsetHeight + bleed + 1) : null
    const token = ++armToken
    current = pieces.slice()
    for (let i = 0; i < pieces.length; i++) {
      setStyle(pieces[i]!, mask ? { ...fromTargets, y: offsets![i]! } : fromTargets, setOptions)
    }
    const h = stagger(
      pieces,
      (piece) => animate(piece, toTargets, animOptions),
      each,
      scheduler !== undefined ? { scheduler } : {},
    )
    void h.finished.then(() => {
      // Settle ONLY on a natural completion of the CURRENT arm (a re-arm bumps the
      // token synchronously, so a stopped arm's resolve is ignored).
      if (token === armToken && !stopped) {
        settled = true
        resolveFinished()
      }
    })
    return h
  }

  // After split rebuilt its pieces (font load / width re-split): release the old
  // detached pieces, then either snap the new ones to rest (already finished or
  // user-stopped - never re-hide the text) or re-arm the spring for the new layout.
  const handleResplit = (resplit: Split): void => {
    const next = resplit.lines
    for (const old of current) releaseStyle(old)
    if (stopped || settled) {
      if (mask) for (const piece of next) wrap(piece)
      current = next.slice()
      for (const piece of next) setStyle(piece, toTargets, setOptions)
    } else {
      handle?.stop()
      handle = armEntrance(next)
    }
  }

  const wantResplit = !reduce && by === 'lines' && (options.resize ?? mask)

  const splitOptions: SplitOptions = {
    type: by === 'chars' ? ['words', 'chars'] : by === 'lines' ? ['words', 'lines'] : ['words'],
    resize: wantResplit,
  }
  if (options.a11y !== undefined) splitOptions.a11y = options.a11y
  if (options.locale !== undefined) splitOptions.locale = options.locale
  if (wantResplit) splitOptions.onResplit = handleResplit
  const result = split(element, splitOptions)

  // Reduced motion: the text is already visible at rest - no wrap, no offset, no
  // motion. (The accessible split is still built.)
  if (reduce) {
    return {
      split: result,
      finished: Promise.resolve(),
      stop() {},
      revert() {
        result.revert()
      },
    }
  }

  const pieces = by === 'chars' ? result.chars : by === 'lines' ? result.lines : result.words
  handle = armEntrance(pieces)

  return {
    split: result,
    finished,
    stop() {
      if (stopped) return
      stopped = true
      handle?.stop()
      resolveFinished()
    },
    revert() {
      stopped = true
      handle?.stop()
      resolveFinished()
      for (const piece of current) releaseStyle(piece)
      result.revert()
    },
  }
}
