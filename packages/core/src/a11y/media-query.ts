/**
 * Watch a media query, lazy and SSR-safe: browser globals are touched only on
 * call, never at import. The current match is emitted SYNCHRONOUSLY on subscribe
 * (so a setup keyed to it applies on mount), then again on every change. Returns
 * an unsubscribe. Generalizes the reduced-motion listener to any query. Internal:
 * not exported from the package entry.
 */
export function watchMedia(query: string, onChange: (matches: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const mql = window.matchMedia(query)
  onChange(mql.matches)
  const handler = (event: MediaQueryListEvent): void => onChange(event.matches)
  mql.addEventListener('change', handler)
  return () => mql.removeEventListener('change', handler)
}
