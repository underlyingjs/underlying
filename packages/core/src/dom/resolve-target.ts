import { warnOnce } from '../value/warn'

/** What animate() accepts as its target: one element, a selector, a NodeList, or any element iterable. */
export type AnimationTarget = HTMLElement | string | NodeList | Iterable<Element>

/**
 * SSR-safe HTMLElement check. `typeof` guard first: HTMLElement is not a global
 * server-side, where a bare `instanceof HTMLElement` would throw ReferenceError.
 * Exported so animate()'s fast-path guard reuses it instead of a bare instanceof.
 */
export const isHTMLElement = (value: unknown): value is HTMLElement =>
  typeof HTMLElement !== 'undefined' && value instanceof HTMLElement

/**
 * Resolve an animate() target to a concrete element list. A selector is queried
 * against `root` (or the document) at call time - a static snapshot, so nodes
 * added later are not animated (re-resolve to pick them up). Non-HTMLElement
 * matches (SVG, text) are filtered out: the animate() registry is HTMLElement-keyed.
 * SSR-safe: a selector with no document resolves to [] (no throw), and an empty
 * selector match warns once.
 */
export function resolveTargets(input: AnimationTarget, root?: ParentNode): HTMLElement[] {
  if (isHTMLElement(input)) return [input]
  if (typeof input === 'string') {
    if (typeof document === 'undefined') {
      warnOnce('targets:ssr', 'animate(selector) needs a document; no targets resolved server-side')
      return []
    }
    const found = Array.from((root ?? document).querySelectorAll(input)).filter(isHTMLElement)
    if (found.length === 0) warnOnce(`targets:empty:${input}`, `selector "${input}" matched no elements`)
    return found
  }
  // NodeList or any Element iterable: keep only HTMLElements.
  return Array.from(input as Iterable<Node>).filter(isHTMLElement)
}
