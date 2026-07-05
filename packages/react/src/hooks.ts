import { useEffect, useRef, type RefObject } from 'react'
import { animate, releaseStyle, type AnimateOptions, type AnimateTargets } from '@underlying/core'
import {
  ambient,
  depth,
  draggable,
  interactive,
  magnetic,
  tilt,
  type AmbientOptions,
  type DepthOptions,
  type DraggableOptions,
  type InteractiveOptions,
  type MagneticOptions,
  type TiltOptions,
} from '@underlying/gestures'
import { reorder, type ReorderOptions } from '@underlying/flip'
import {
  reveal,
  scramble,
  split,
  typewriter,
  type RevealOptions,
  type ScrambleOptions,
  type SplitOptions,
  type TypewriterOptions,
} from '@underlying/text'

/**
 * Bind a primitive to a ref: created on mount, cleaned up on unmount. Options are
 * captured at mount (the primitives read them once), so pass a stable object.
 * `bind` returns the cleanup function. Attach the returned ref to your element.
 */
function useBind<T extends HTMLElement, O>(
  bind: (el: T, options: O | undefined) => () => void,
  options: O | undefined,
): RefObject<T | null> {
  const ref = useRef<T>(null)
  const latest = useRef(options)
  latest.current = options
  useEffect(() => {
    const el = ref.current
    if (el === null) return undefined
    return bind(el, latest.current)
  }, [])
  return ref
}

// --- Gestures ---

const bindDraggable = <T extends HTMLElement>(el: T, o: DraggableOptions | undefined): (() => void) => {
  const h = draggable(el, o)
  return () => h.dispose()
}
/** Make the ref'd element draggable (momentum-aware). Attach the ref: `<div ref={useDraggable()} />`. */
export function useDraggable<T extends HTMLElement = HTMLElement>(options?: DraggableOptions): RefObject<T | null> {
  return useBind(bindDraggable, options)
}

const bindTilt = <T extends HTMLElement>(el: T, o: TiltOptions | undefined): (() => void) => {
  const h = tilt(el, o)
  return () => h.dispose()
}
/** 3D card tilt toward the pointer. */
export function useTilt<T extends HTMLElement = HTMLElement>(options?: TiltOptions): RefObject<T | null> {
  return useBind(bindTilt, options)
}

const bindMagnetic = <T extends HTMLElement>(el: T, o: MagneticOptions | undefined): (() => void) => {
  const h = magnetic(el, o)
  return () => h.dispose()
}
/** Magnetic pull toward the pointer within a radius. */
export function useMagnetic<T extends HTMLElement = HTMLElement>(options?: MagneticOptions): RefObject<T | null> {
  return useBind(bindMagnetic, options)
}

const bindDepth = <T extends HTMLElement>(el: T, o: DepthOptions | undefined): (() => void) => {
  const h = depth(el, o)
  return () => h.dispose()
}
/** Pointer-driven 2.5D depth parallax. */
export function useDepth<T extends HTMLElement = HTMLElement>(options?: DepthOptions): RefObject<T | null> {
  return useBind(bindDepth, options)
}

const bindAmbient = <T extends HTMLElement>(el: T, o: AmbientOptions | undefined): (() => void) => {
  const h = ambient(el, o)
  return () => h.dispose()
}
/** Perpetual idle / ambient self-animation (breathe / drift / bob / wander). */
export function useAmbient<T extends HTMLElement = HTMLElement>(options?: AmbientOptions): RefObject<T | null> {
  return useBind(bindAmbient, options)
}

const bindInteractive = <T extends HTMLElement>(el: T, o: InteractiveOptions | undefined): (() => void) => {
  const h = interactive(el, o)
  return () => h.dispose()
}
/** Declarative hover / press state (springy scale / lift), keyboard-aware. */
export function useInteractive<T extends HTMLElement = HTMLElement>(
  options?: InteractiveOptions,
): RefObject<T | null> {
  return useBind(bindInteractive, options)
}

// --- Text ---

const bindSplit = <T extends HTMLElement>(el: T, o: SplitOptions | undefined): (() => void) => {
  const h = split(el, o)
  return () => h.revert()
}
/** Split the ref'd element's text into lines / words / chars, reverted on unmount. */
export function useSplit<T extends HTMLElement = HTMLElement>(options?: SplitOptions): RefObject<T | null> {
  return useBind(bindSplit, options)
}

const bindReveal = <T extends HTMLElement>(el: T, o: RevealOptions | undefined): (() => void) => {
  const h = reveal(el, o)
  return () => h.revert()
}
/** Masked per-line / word / char reveal on the ref'd element's text. */
export function useReveal<T extends HTMLElement = HTMLElement>(options?: RevealOptions): RefObject<T | null> {
  return useBind(bindReveal, options)
}

/** Typewriter effect writing `text` into the ref'd element. */
export function useTypewriter<T extends HTMLElement = HTMLElement>(
  text: string,
  options?: TypewriterOptions,
): RefObject<T | null> {
  const ref = useRef<T>(null)
  const latest = useRef({ text, options })
  latest.current = { text, options }
  useEffect(() => {
    const el = ref.current
    if (el === null) return undefined
    const h = typewriter(el, latest.current.text, latest.current.options)
    return () => h.stop()
  }, [])
  return ref
}

/** Scramble-in effect writing `text` into the ref'd element. */
export function useScramble<T extends HTMLElement = HTMLElement>(
  text: string,
  options?: ScrambleOptions,
): RefObject<T | null> {
  const ref = useRef<T>(null)
  const latest = useRef({ text, options })
  latest.current = { text, options }
  useEffect(() => {
    const el = ref.current
    if (el === null) return undefined
    const h = scramble(el, latest.current.text, latest.current.options)
    return () => h.stop()
  }, [])
  return ref
}

// --- FLIP ---

const bindReorder = <T extends HTMLElement>(el: T, o: ReorderOptions | undefined): (() => void) => {
  const h = reorder(el, o)
  return () => h.dispose()
}
/** Drag-to-reorder the ref'd container's children. */
export function useReorder<T extends HTMLElement = HTMLElement>(options?: ReorderOptions): RefObject<T | null> {
  return useBind(bindReorder, options)
}

// --- Reactive animate ---

/**
 * Spring the ref'd element toward `targets`; when `targets` changes the element
 * retargets the same live channels (interruptible, velocity conserved - never a
 * restart). Options are read from the latest render. Styles are released on unmount.
 *
 * ```tsx
 * const ref = useAnimate<HTMLDivElement>({ x: open ? 200 : 0 })
 * return <div ref={ref} />
 * ```
 */
export function useAnimate<T extends HTMLElement = HTMLElement>(
  targets: AnimateTargets,
  options?: AnimateOptions,
): RefObject<T | null> {
  const ref = useRef<T>(null)
  const opts = useRef(options)
  opts.current = options
  // No deps: re-run each render. A physics-first animate() retargets the same
  // channels to the (possibly unchanged) target, so an idle re-run is a no-op.
  useEffect(() => {
    const el = ref.current
    if (el !== null) animate(el, targets, opts.current)
  })
  // Release the inline styles once, on unmount.
  useEffect(() => {
    return () => {
      const el = ref.current
      if (el !== null) releaseStyle(el)
    }
  }, [])
  return ref
}
