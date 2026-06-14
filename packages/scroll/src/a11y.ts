import { onReducedMotionChange, prefersReducedMotion } from '@underlying/core'

/**
 * The single reduced-motion policy every builder consults. It is a thin seam
 * over core's a11y so the degradation ladder (momentum scrub -> locked,
 * parallax -> off, momentum snap -> instant) lives in ONE place and re-routes
 * live when the preference toggles mid-session.
 */
export interface MotionPolicy {
  /** True when the user asked for reduced motion (override, else OS). */
  reduced(): boolean
  /** Subscribe to effective-preference changes. Returns an unsubscribe. */
  onChange(listener: (reduced: boolean) => void): () => void
}

/** The default policy, wired to core's lazy/SSR-safe reduced-motion state. */
export function createMotionPolicy(): MotionPolicy {
  return {
    reduced: prefersReducedMotion,
    onChange: onReducedMotionChange,
  }
}
