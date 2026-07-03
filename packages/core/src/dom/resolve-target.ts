import { warnOnce } from '../value/warn'

/**
 * An element animate() can drive: an HTML or SVG element. Both carry `.style`,
 * `getAttribute`/`setAttribute`, and resolve under getComputedStyle, so the same
 * style + attribute machinery serves both (SVG unlocks viewBox/r/points via `attr:`).
 */
export type AnimatableElement = HTMLElement | SVGElement

/** What animate() accepts as its target: one element, a selector, a NodeList, or any element iterable. */
export type AnimationTarget = AnimatableElement | string | NodeList | Iterable<Element>

/**
 * SSR-safe HTMLElement check. `typeof` guard first: HTMLElement is not a global
 * server-side, where a bare `instanceof HTMLElement` would throw ReferenceError.
 * Exported so animate()'s fast-path guard reuses it instead of a bare instanceof.
 */
export const isHTMLElement = (value: unknown): value is HTMLElement =>
  typeof HTMLElement !== 'undefined' && value instanceof HTMLElement

/** SSR-safe check for an animatable (HTML or SVG) element. */
export const isAnimatableElement = (value: unknown): value is AnimatableElement =>
  (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) ||
  (typeof SVGElement !== 'undefined' && value instanceof SVGElement)

/**
 * Resolve an animate() target to a concrete element list. A selector is queried
 * against `root` (or the document) at call time - a static snapshot, so nodes
 * added later are not animated (re-resolve to pick them up). Non-element matches
 * (text nodes) are filtered out. SSR-safe: a selector with no document resolves to
 * [] (no throw), and an empty selector match warns once.
 */
export function resolveTargets(input: AnimationTarget, root?: ParentNode): AnimatableElement[] {
  if (isAnimatableElement(input)) return [input]
  if (typeof input === 'string') {
    if (typeof document === 'undefined') {
      warnOnce('targets:ssr', 'animate(selector) needs a document; no targets resolved server-side')
      return []
    }
    const found = Array.from((root ?? document).querySelectorAll(input)).filter(isAnimatableElement)
    if (found.length === 0) warnOnce(`targets:empty:${input}`, `selector "${input}" matched no elements`)
    return found
  }
  // NodeList or any Element iterable: keep only HTML/SVG elements.
  return Array.from(input as Iterable<Node>).filter(isAnimatableElement)
}
