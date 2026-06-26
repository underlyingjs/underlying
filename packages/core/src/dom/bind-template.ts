import type { Scheduler } from '../scheduler/scheduler'
import type { Animatable } from '../value/animatable'
import { formatChannelNumber, type ChannelMeta } from '../value/value-type'
import { bindProperty, type FormatSource } from './bind-property'

/** A live scalar slot: a bare Animatable, or anything exposing one (e.g. follow()). */
export type TemplateSource = Animatable | { readonly value: Animatable }

/** A template interpolation: a live source, or a constant folded into the surrounding literal. */
export type TemplateSlot = TemplateSource | number | string

/** The tag's return: the live sources in slot order plus a pure string-splice. Owns no physics, DOM, or subscription. */
export interface StyleTemplate {
  readonly sources: readonly Animatable[]
  format(parts: readonly string[]): string
}

export interface BindTemplateOptions {
  scheduler?: Scheduler
  /** Decimals kept per numeric slot in the tagged form (default 4, matching the complex value type). */
  precision?: number
}

/** The function form spreads RAW numbers (the author rounds), so `precision` does not apply there. */
type FunctionFormOptions = Pick<BindTemplateOptions, 'scheduler'>

/** Map a sources tuple to a same-length tuple of plain numbers, so the function formatter is arity- and order-safe. */
type NumbersOf<S extends readonly unknown[]> = { -readonly [K in keyof S]: number }

// A bare Animatable has .get; a follow()-style wrapper exposes .value (an Animatable);
// a number/string is a constant -> null. The discriminator is unambiguous.
const asAnimatable = (slot: TemplateSlot): Animatable | null => {
  if (typeof slot !== 'object' || slot === null) return null
  if (typeof (slot as { get?: unknown }).get === 'function') return slot as Animatable
  const inner = (slot as { value?: unknown }).value
  if (inner !== null && typeof inner === 'object' && typeof (inner as { get?: unknown }).get === 'function') {
    return inner as Animatable
  }
  return null
}

/**
 * Tagged template: compose live scalar sources (an `animatable`, a `follow()`, a
 * scroll/pointer spring) and constants into one reactive CSS string. The literal
 * chunks carry the units and CSS punctuation; the interpolations are the live
 * values. Pure and SSR-inert - it builds in-memory data, touches no DOM, and can
 * be bound later via bindTemplate().
 */
export function template(strings: TemplateStringsArray, ...slots: readonly TemplateSlot[]): StyleTemplate {
  const sources: Animatable[] = []
  const literals: string[] = [strings[0] ?? '']
  for (let i = 0; i < slots.length; i++) {
    const tail = strings[i + 1] ?? ''
    const source = asAnimatable(slots[i]!)
    if (source !== null) {
      sources.push(source)
      literals.push(tail)
    } else {
      // A constant: fold it into the preceding literal so it never subscribes.
      literals[literals.length - 1] += String(slots[i]) + tail
    }
  }
  return {
    sources,
    format(parts) {
      let out = literals[0] ?? ''
      for (let i = 0; i < parts.length; i++) out += parts[i]! + (literals[i + 1] ?? '')
      return out
    },
  }
}

// Subscribe one listener to each UNIQUE source (a source used in two slots
// subscribes once); return a single combined unsubscribe.
const fanIn = (sources: readonly Animatable[], listener: () => void): (() => void) => {
  const offs: Array<() => void> = []
  for (const source of new Set(sources)) offs.push(source.on('change', listener))
  return () => {
    for (const off of offs) off()
  }
}

/**
 * Bind a composed CSS string to one element property, driven each frame by N live
 * sources. Writes to ANY property including a `--custom` one, through the same
 * render-phase binder as animate(): one flush per frame, byte-deduped (idle-quiet
 * at rest), synchronous at bind time. Returns a disposer that tears down every
 * source subscription and any pending write - drop it into `region.add(...)`.
 * A read-only projection: it never disposes its sources (the caller owns those).
 *
 * Tag form (headline): `bindTemplate(el, 'filter', template`blur(${b}px)`)`.
 * Function form (escape hatch): `bindTemplate(el, 'transform', [x, y], (px, py) => ...)`.
 */
export function bindTemplate(
  element: HTMLElement,
  property: string,
  styleTemplate: StyleTemplate,
  options?: BindTemplateOptions,
): () => void
export function bindTemplate<const S extends readonly TemplateSource[]>(
  element: HTMLElement,
  property: string,
  sources: S,
  format: (...values: NumbersOf<S>) => string,
  options?: FunctionFormOptions,
): () => void
export function bindTemplate(
  element: HTMLElement,
  property: string,
  a: StyleTemplate | readonly TemplateSource[],
  b?: BindTemplateOptions | ((...values: number[]) => string),
  c?: BindTemplateOptions,
): () => void {
  let source: FormatSource
  let options: BindTemplateOptions

  if (Array.isArray(a)) {
    // Function form: raw numbers spread into the author's formatter.
    const format = b as (...values: number[]) => string
    options = c ?? {}
    const sources = (a as readonly TemplateSource[]).map(asAnimatable).filter((s): s is Animatable => s !== null)
    const scratch = new Array<number>(sources.length)
    source = {
      format() {
        for (let i = 0; i < sources.length; i++) scratch[i] = sources[i]!.get()
        return format(...scratch)
      },
      onChange: (listener) => fanIn(sources, listener),
    }
  } else {
    // Tag form: engine-consistent rounded slots spliced into the template.
    const tpl = a as StyleTemplate
    options = (b as BindTemplateOptions | undefined) ?? {}
    const meta: ChannelMeta = { precision: options.precision ?? 4 }
    const sources = tpl.sources
    const scratch = new Array<string>(sources.length)
    source = {
      format() {
        for (let i = 0; i < sources.length; i++) scratch[i] = formatChannelNumber(sources[i]!.get(), meta)
        return tpl.format(scratch)
      },
      onChange: (listener) => fanIn(sources, listener),
    }
  }

  const binding = bindProperty(
    element,
    property,
    source,
    options.scheduler !== undefined ? { scheduler: options.scheduler } : {},
  )
  return () => binding.dispose()
}
