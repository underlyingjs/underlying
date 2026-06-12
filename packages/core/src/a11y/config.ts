/**
 * What happens when the user prefers reduced motion:
 * - 'skip'  (default): animations land instantly on their rest state
 * - 'fade'  : movement snaps, element-level opacity still animates (animate())
 * - 'allow' : motion plays normally (only for essential, e.g. gesture-driven, motion)
 */
export type ReducedMotionBehavior = 'skip' | 'fade' | 'allow'

/** Per-animation override on a raw value - fade only makes sense element-side. */
export type ReducedMotionOverride = 'skip' | 'allow'

let behavior: ReducedMotionBehavior = 'skip'

export const setReducedMotionBehavior = (next: ReducedMotionBehavior): void => {
  behavior = next
}

export const getReducedMotionBehavior = (): ReducedMotionBehavior => behavior
