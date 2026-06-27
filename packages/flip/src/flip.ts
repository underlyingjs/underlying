import {
  invertAndSpring,
  keyOf,
  measure,
  seizeVelocity,
  toElements,
  ZERO_VELOCITY,
  type Box,
  type FlipOptions,
  type FlipTargets,
  type Velocity,
} from './engine'

export type { FlipOptions, FlipTargets } from './engine'

export interface FlipPlayOptions extends FlipOptions {
  /** The elements to animate from the snapshot boxes, matched by `data-flip-id`. */
  targets: FlipTargets
}

/** A captured set of element boxes, keyed by `data-flip-id` (or the element itself). */
export interface FlipSnapshot {
  readonly boxes: ReadonlyMap<string | HTMLElement, Box>
}

/**
 * Physics-first FLIP. Measures each element's box (First), runs `mutate` to
 * change the DOM, measures again (Last), applies the inverse transform - both
 * position AND size - so nothing visibly jumps, then springs every element to
 * its new place. The play is a spring, not a baked tween: call flip() again
 * mid-flight and each element retargets from its live position and velocity, so
 * the motion bends into the new layout instead of restarting. That
 * interruptibility is the whole point.
 */
export function flip(targets: FlipTargets, mutate: () => void, options: FlipOptions = {}): void {
  const elements = toElements(targets)

  // First: current visual box (with any in-flight transform), plus the live
  // velocity of a running spring.
  const first = new Map<HTMLElement, Box>()
  const velocity = new Map<HTMLElement, Velocity>()
  for (const element of elements) {
    first.set(element, measure(element))
    velocity.set(element, seizeVelocity(element))
  }

  // Strip transforms so the Last measurement is the natural layout box.
  for (const element of elements) element.style.transform = ''

  mutate()

  for (const element of elements) {
    const box = first.get(element)
    if (box === undefined) continue
    invertAndSpring(element, box, velocity.get(element) ?? ZERO_VELOCITY, options)
  }
}

/**
 * Capture each target's box, keyed by its `data-flip-id` (or the element
 * itself). Pair with `play()` for shared-element / route transitions, where the
 * old elements and the new ones are different DOM nodes: snapshot the old set,
 * change the DOM, then play the new set from the captured boxes.
 */
export function snapshot(targets: FlipTargets): FlipSnapshot {
  const boxes = new Map<string | HTMLElement, Box>()
  for (const element of toElements(targets)) boxes.set(keyOf(element), measure(element))
  return { boxes }
}

/**
 * Animate each target from its matching box in the snapshot to its current
 * place - matched by `data-flip-id`. A target with no match in the snapshot is
 * left alone. Interruptible like `flip()`.
 */
export function play(snap: FlipSnapshot, options: FlipPlayOptions): void {
  for (const element of toElements(options.targets)) {
    const first = snap.boxes.get(keyOf(element))
    if (first === undefined) continue
    const velocity = seizeVelocity(element)
    element.style.transform = '' // ensure Last is the natural box
    invertAndSpring(element, first, velocity, options)
  }
}
