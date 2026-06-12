type ReducedMotionListener = (reduced: boolean) => void

// Lazy: browser globals are only touched on first use, never at import
// (SSR-safe). The media query is watched so mid-session OS toggles are
// reflected in every subsequent animation start. An app-level override
// (in-app accessibility toggle, demos, tests) takes precedence over the OS.
let initialized = false
let current = false
let override: boolean | null = null
const listeners = new Set<ReducedMotionListener>()

const effective = (): boolean => override ?? current

const notifyIfChanged = (before: boolean) => {
  const after = effective()
  if (after === before) return
  for (const listener of [...listeners]) listener(after)
}

const init = () => {
  if (initialized) return
  initialized = true
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  current = query.matches
  query.addEventListener('change', (event) => {
    const before = effective()
    current = event.matches
    notifyIfChanged(before)
  })
}

/** Current effective preference (override, else OS). False when no DOM. */
export function prefersReducedMotion(): boolean {
  init()
  return effective()
}

/**
 * App-level override of the OS preference - in-app accessibility toggles.
 * `null` returns control to the OS media query.
 */
export function setReducedMotionOverride(value: boolean | null): void {
  init()
  const before = effective()
  override = value
  notifyIfChanged(before)
}

/** Notifies on effective preference changes. Returns an unsubscribe. */
export function onReducedMotionChange(listener: ReducedMotionListener): () => void {
  init()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test-only: clears the cached media query state. Not part of the public API. */
export function __resetReducedMotion(): void {
  initialized = false
  current = false
  override = null
  listeners.clear()
}
