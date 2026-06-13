import { colorValueType } from './types/color'
import { complexValueType } from './types/complex'
import { lengthValueType } from './types/length'
import { numberValueType } from './types/number'
import type { ValueType } from './value-type'
import { warnOnce } from './warn'

// Property -> value-type map. Built-in seeds are installed LAZILY on first
// resolution, never at module scope: a top-level Map.set() would be retained by
// flat-bundle tree-shakers (esbuild/Vite) even for a transforms-only user. The
// CI tree-shake probe enforces that this module stays out of the primitives
// graph entirely.
const registry = new Map<string, ValueType>()
const shorthands = new Set<string>()
let seeded = false

// camelCase property names, space-packed to keep the seed table small.
const LENGTH_PROPERTIES =
  'width height minWidth minHeight maxWidth maxHeight top right bottom left ' +
  'marginTop marginRight marginBottom marginLeft paddingTop paddingRight paddingBottom paddingLeft ' +
  'fontSize letterSpacing wordSpacing textIndent gap rowGap columnGap outlineWidth outlineOffset ' +
  'borderTopWidth borderRightWidth borderBottomWidth borderLeftWidth ' +
  'borderTopLeftRadius borderTopRightRadius borderBottomLeftRadius borderBottomRightRadius'

const COLOR_PROPERTIES =
  'color backgroundColor borderTopColor borderRightColor borderBottomColor borderLeftColor ' +
  'outlineColor textDecorationColor caretColor accentColor fill stroke'

const NUMBER_PROPERTIES = 'flexGrow flexShrink fontWeight'

// Shorthands expand to longhands the browser reorders and pads unpredictably:
// resolve them to the complex fallback but warn first, pointing at the longhand.
const SHORTHAND_PROPERTIES = 'margin padding border background font borderRadius borderColor borderWidth'

const seed = (): void => {
  if (seeded) return
  seeded = true
  for (const property of LENGTH_PROPERTIES.split(' ')) registry.set(property, lengthValueType)
  for (const property of COLOR_PROPERTIES.split(' ')) registry.set(property, colorValueType)
  for (const property of NUMBER_PROPERTIES.split(' ')) registry.set(property, numberValueType)
  for (const property of SHORTHAND_PROPERTIES.split(' ')) shorthands.add(property)
}

/**
 * Claim properties for a descriptor - the extension point for @underlying/color,
 * @underlying/scroll, and app code. Call it from explicit user code only, never
 * from a module's import side effects (a sideEffects:false bundler would drop
 * the registration). Later registrations win for groups created afterwards;
 * a live group keeps the descriptor it was created with.
 */
export function registerValueType(properties: readonly string[], type: ValueType): void {
  seed()
  for (const property of properties) {
    if (registry.get(property) !== undefined) {
      warnOnce(
        `reregister:${property}`,
        `value type for "${property}" re-registered; existing groups keep their current descriptor`,
      )
    }
    registry.set(property, type)
  }
}

/** Resolve a property to its value type. Unknown and custom (--*) properties fall back to complex. */
export function resolveValueType(property: string): ValueType {
  seed()
  const existing = registry.get(property)
  if (existing !== undefined) return existing
  if (shorthands.has(property)) {
    warnOnce(
      `shorthand:${property}`,
      `"${property}" is a shorthand; animate its longhands (e.g. ${property}Top) for predictable results`,
    )
    return complexValueType
  }
  return complexValueType
}

/** Test-only: whether the built-in seeds have been installed yet. */
export function __isSeeded(): boolean {
  return seeded
}

/** Test-only: clears all registrations and the seed flag. */
export function __resetRegistry(): void {
  registry.clear()
  shorthands.clear()
  seeded = false
}
