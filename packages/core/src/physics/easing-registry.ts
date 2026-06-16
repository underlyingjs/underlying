import { warnOnce } from '../value/warn'
import { easeInOutCubic, type Easing } from './easings'

/** A passed easing: a function, or a GSAP-style name ('power2.out', 'elastic.out(1, 0.3)'). */
export type EasingInput = Easing | string

export type EasingVariant = 'in' | 'out' | 'inOut'

/** Builds the actual easing for a named family, given the variant and any numeric params. */
export type EasingFactory = (variant: EasingVariant, params: ReadonlyArray<number>) => Easing

// Named ease families live here. Nothing is registered at module scope - a
// top-level set() would pin this into the primitives tree-shake graph;
// @underlying/utils registers the families on import instead.
const registry = new Map<string, EasingFactory>()

/** Register a named ease family ('power2', 'elastic', 'steps', ...) so strings resolve. */
export function registerEasing(name: string, factory: EasingFactory): void {
  registry.set(name.toLowerCase(), factory)
}

const SPEC = /^([a-z]+\d*)(?:\.(inout|in|out))?(?:\(([^)]*)\))?$/i

const parseSpec = (spec: string): { name: string; variant: EasingVariant; params: number[] } | null => {
  const match = SPEC.exec(spec.trim())
  if (match === null) return null
  const variantRaw = match[2]?.toLowerCase()
  const variant: EasingVariant = variantRaw === 'in' ? 'in' : variantRaw === 'inout' ? 'inOut' : 'out'
  const params =
    match[3] !== undefined && match[3].trim() !== '' ? match[3].split(',').map((part) => Number(part.trim())) : []
  return { name: match[1]!.toLowerCase(), variant, params }
}

/**
 * Resolve a function-or-name into an Easing. Functions pass through untouched;
 * an unknown name warns once and falls back to easeInOutCubic.
 */
export function resolveEasing(input: EasingInput): Easing {
  if (typeof input !== 'string') return input
  const parsed = parseSpec(input)
  if (parsed !== null) {
    const factory = registry.get(parsed.name)
    if (factory !== undefined) return factory(parsed.variant, parsed.params)
  }
  warnOnce(
    `easing:${input}`,
    `unknown easing "${input}" - import @underlying/utils to register named eases. Using easeInOutCubic.`,
  )
  return easeInOutCubic
}
