import { onBeforeUnmount, onMounted, ref, toValue, watchEffect, type MaybeRefOrGetter, type Ref } from 'vue'
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
 * A template ref bound to a primitive: created on mount, disposed on unmount.
 * Bind the returned ref in your template (`<div :ref="el">`). Options are read at
 * mount (the primitives read them once). `bind` returns the cleanup function.
 */
function useBind<T extends HTMLElement, O>(
  bind: (el: T, options: O | undefined) => () => void,
  options: O | undefined,
): Ref<T | null> {
  const el = ref<T | null>(null) as Ref<T | null>
  let cleanup: (() => void) | null = null
  onMounted(() => {
    if (el.value !== null) cleanup = bind(el.value, options)
  })
  onBeforeUnmount(() => {
    cleanup?.()
    cleanup = null
  })
  return el
}

// --- Gestures ---

/** Make the ref'd element draggable (momentum-aware). */
export function useDraggable<T extends HTMLElement = HTMLElement>(options?: DraggableOptions): Ref<T | null> {
  return useBind((el, o) => {
    const h = draggable(el, o)
    return () => h.dispose()
  }, options)
}

/** 3D card tilt toward the pointer. */
export function useTilt<T extends HTMLElement = HTMLElement>(options?: TiltOptions): Ref<T | null> {
  return useBind((el, o) => {
    const h = tilt(el, o)
    return () => h.dispose()
  }, options)
}

/** Magnetic pull toward the pointer within a radius. */
export function useMagnetic<T extends HTMLElement = HTMLElement>(options?: MagneticOptions): Ref<T | null> {
  return useBind((el, o) => {
    const h = magnetic(el, o)
    return () => h.dispose()
  }, options)
}

/** Pointer-driven 2.5D depth parallax. */
export function useDepth<T extends HTMLElement = HTMLElement>(options?: DepthOptions): Ref<T | null> {
  return useBind((el, o) => {
    const h = depth(el, o)
    return () => h.dispose()
  }, options)
}

/** Perpetual idle / ambient self-animation (breathe / drift / bob / wander). */
export function useAmbient<T extends HTMLElement = HTMLElement>(options?: AmbientOptions): Ref<T | null> {
  return useBind((el, o) => {
    const h = ambient(el, o)
    return () => h.dispose()
  }, options)
}

/** Declarative hover / press state (springy scale / lift), keyboard-aware. */
export function useInteractive<T extends HTMLElement = HTMLElement>(options?: InteractiveOptions): Ref<T | null> {
  return useBind((el, o) => {
    const h = interactive(el, o)
    return () => h.dispose()
  }, options)
}

// --- Text ---

/** Split the ref'd element's text into lines / words / chars, reverted on unmount. */
export function useSplit<T extends HTMLElement = HTMLElement>(options?: SplitOptions): Ref<T | null> {
  return useBind((el, o) => {
    const h = split(el, o)
    return () => h.revert()
  }, options)
}

/** Masked per-line / word / char reveal on the ref'd element's text. */
export function useReveal<T extends HTMLElement = HTMLElement>(options?: RevealOptions): Ref<T | null> {
  return useBind((el, o) => {
    const h = reveal(el, o)
    return () => h.revert()
  }, options)
}

/**
 * Typewriter effect writing `text` into the ref'd element. `text` and options are
 * read once on mount (it is a one-shot entrance); later changes do not re-type.
 * Remount the element (e.g. with a `key`) to play it again with new text.
 */
export function useTypewriter<T extends HTMLElement = HTMLElement>(
  text: string,
  options?: TypewriterOptions,
): Ref<T | null> {
  return useBind((el) => {
    const h = typewriter(el, text, options)
    return () => h.stop()
  }, options)
}

/**
 * Scramble-in effect writing `text` into the ref'd element. `text` and options are
 * read once on mount (it is a one-shot entrance); later changes do not re-run.
 * Remount the element (e.g. with a `key`) to play it again with new text.
 */
export function useScramble<T extends HTMLElement = HTMLElement>(
  text: string,
  options?: ScrambleOptions,
): Ref<T | null> {
  return useBind((el) => {
    const h = scramble(el, text, options)
    return () => h.stop()
  }, options)
}

// --- FLIP ---

/** Drag-to-reorder the ref'd container's children. */
export function useReorder<T extends HTMLElement = HTMLElement>(options?: ReorderOptions): Ref<T | null> {
  return useBind((el, o) => {
    const h = reorder(el, o)
    return () => h.dispose()
  }, options)
}

// --- Reactive animate ---

/**
 * Spring the ref'd element toward `targets`; when the reactive `targets` changes
 * the element retargets the same live channels (interruptible, velocity conserved).
 * `targets` may be a ref, a getter, or a plain object. Styles are released on unmount.
 *
 * ```ts
 * const el = useAnimate<HTMLDivElement>(() => ({ x: open.value ? 200 : 0 }))
 * ```
 */
export function useAnimate<T extends HTMLElement = HTMLElement>(
  targets: MaybeRefOrGetter<AnimateTargets>,
  options?: AnimateOptions,
): Ref<T | null> {
  const el = ref<T | null>(null) as Ref<T | null>
  // Runs immediately (el null -> skip) and re-runs when el mounts or targets
  // change; Vue auto-stops the effect on unmount.
  watchEffect(() => {
    if (el.value !== null) animate(el.value, toValue(targets), options)
  })
  onBeforeUnmount(() => {
    if (el.value !== null) releaseStyle(el.value)
  })
  return el
}
