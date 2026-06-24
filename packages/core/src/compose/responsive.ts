import { watchMedia } from '../a11y/media-query'
import { onReducedMotionChange, prefersReducedMotion } from '../a11y/reduced-motion'

/** Runs when the query starts matching; an optional returned teardown runs when it stops. */
export type ResponsiveSetup = (context: { matches: boolean }) => void | (() => void)

/**
 * Run `setup` whenever `query` starts matching, and its returned teardown when it
 * stops. A string is any media query - '(prefers-reduced-motion: reduce)' is just
 * a query. The `{ reducedMotion }` form reuses the reduced-motion source, so it
 * honors the app-level override too. Returns an unsubscribe that runs any live
 * teardown and stops listening.
 *
 * SSR-safe and client-only: with no matchMedia the setup never runs server-side -
 * it runs on mount when the query matches, never with a guessed server value.
 */
export function responsive(query: string | { reducedMotion: boolean }, setup: ResponsiveSetup): () => void {
  let active = false
  let teardown: (() => void) | null = null

  const apply = (matches: boolean): void => {
    if (matches && !active) {
      active = true
      const result = setup({ matches: true })
      teardown = typeof result === 'function' ? result : null
    } else if (!matches && active) {
      active = false
      const run = teardown
      teardown = null
      run?.()
    }
  }

  const dispose = (): void => {
    if (!active) return
    active = false
    const run = teardown
    teardown = null
    run?.()
  }

  if (typeof query === 'string') {
    const stop = watchMedia(query, apply)
    return () => {
      stop()
      dispose()
    }
  }

  // reducedMotion form: reuse the reduced-motion source (override-aware), so it
  // is not a second matcher and respects setReducedMotionOverride. Client-only,
  // like the string form: do not apply the initial state server-side (where
  // prefersReducedMotion() is a no-DOM default), or a reduced-motion-OFF setup
  // would run during SSR. The listener subscription is harmless server-side.
  const want = query.reducedMotion
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    apply(prefersReducedMotion() === want)
  }
  const off = onReducedMotionChange((reduced) => apply(reduced === want))
  return () => {
    off()
    dispose()
  }
}
