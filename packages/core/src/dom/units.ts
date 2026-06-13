import type { MeasureUnit } from '../value/value-type'
import type { StyleReader } from './read-style'

// Percentages resolve against the containing block: the block axis for these
// properties, the inline axis (parent width) for everything else - including all
// margins and paddings, per CSS.
const BLOCK_AXIS = new Set(['height', 'minHeight', 'maxHeight', 'top', 'bottom', 'rowGap'])

const positive = (value: number): number | null =>
  Number.isFinite(value) && value > 0 ? value : null

/**
 * Builds the "px per 1 unit" function for one element+property context, used by
 * a value type's `convert` to rebase across units. Reads happen at most once per
 * unit (memoized) and only when that unit is actually requested; an unmeasurable
 * unit (no parent, zero/auto computed basis, unknown unit) returns null, which
 * makes the caller snap rather than mix incompatible units.
 */
export function createMeasure(
  element: HTMLElement,
  property: string,
  read: StyleReader,
): MeasureUnit {
  const cache = new Map<string, number | null>()

  const viewport = (pick: (w: number, h: number) => number): number | null => {
    const doc = element.ownerDocument.documentElement
    return positive(pick(doc.clientWidth, doc.clientHeight) / 100)
  }

  const compute = (unit: string): number | null => {
    switch (unit) {
      case 'px':
        return 1
      case 'em':
        return positive(parseFloat(read.get('fontSize')))
      case 'rem':
        return positive(parseFloat(getComputedStyle(element.ownerDocument.documentElement).fontSize))
      case '%': {
        const parent = element.parentElement
        if (parent === null) return null
        const parentStyle = getComputedStyle(parent)
        const basis = BLOCK_AXIS.has(property) ? parentStyle.height : parentStyle.width
        return positive(parseFloat(basis) / 100)
      }
      case 'vw':
        return viewport((w) => w)
      case 'vh':
        return viewport((_w, h) => h)
      case 'vmin':
        return viewport((w, h) => Math.min(w, h))
      case 'vmax':
        return viewport((w, h) => Math.max(w, h))
      default:
        return null
    }
  }

  return (unit) => {
    const cached = cache.get(unit)
    if (cached !== undefined) return cached
    const value = compute(unit)
    cache.set(unit, value)
    return value
  }
}
