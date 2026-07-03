/** camelCase or custom property -> the kebab name getComputedStyle/setProperty expect. */
export function toKebab(property: string): string {
  if (property.startsWith('--')) return property
  return property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

export interface StyleReader {
  /** Computed value of a property (kebab-converted), trimmed. '' when unset. */
  get(property: string): string
}

/**
 * An attribute reader with the same shape as `readStyle` - `get(name)` returns
 * the element's current attribute value (`getAttribute`), '' when unset. The seam
 * for animating SVG/element attributes (viewBox, r, points) through the same group
 * machinery as style properties.
 */
export function readAttribute(element: Element): StyleReader {
  return {
    get(name) {
      return (element.getAttribute(name) ?? '').trim()
    },
  }
}

/**
 * One getComputedStyle(element) per animate()/setStyle() call, evaluated lazily
 * and shared by every property read of that call - getComputedStyle forces a
 * style/layout flush, so it must happen at most once and before any write.
 * Lazy so a call that never reads (pure numeric fast path) touches no DOM.
 */
export function readStyle(element: Element): StyleReader {
  let computed: CSSStyleDeclaration | null = null
  return {
    get(property) {
      computed ??= getComputedStyle(element)
      return computed.getPropertyValue(toKebab(property)).trim()
    },
  }
}
