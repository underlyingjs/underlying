import { formatChannelNumber, type ChannelMeta, type ValueType } from '../value-type'
import { COLOR_METAS, formatColor, parseColor } from './color'

// The generic value type: any CSS value that is a mix of literal text, numbers
// (with units), and embedded colors - box-shadow, filter, the fallback for
// unknown and custom properties. One tokenizer pass turns a value into scalar
// channels plus a SHAPE that IS the compiled template: same token kinds with
// the same literals and units share a shape and are channel-for-channel
// interpolable; anything else is a different shape (snap, not a silent
// mis-mix). The hot path (format) never tokenizes - it reuses the template.

type Token = { kind: 'number'; unit: string } | { kind: 'color' }

interface Template {
  literals: string[] // length = tokens.length + 1
  tokens: Token[]
}

const NUMBER_TOKEN_META: ChannelMeta = { precision: 4, restDelta: 0.01, restSpeed: 0.1 }

// Token-slot delimiter inside a shape string. NUL never appears in a CSS value,
// so literal chunks (which freely contain spaces, parens, commas) never collide
// with the slot markers `<NUL>c<NUL>` (color) and `<NUL>n:<unit><NUL>` (number).
const SEP = '\u0000'
const colorSlot = `${SEP}c${SEP}`
const numberSlot = (unit: string): string => `${SEP}n:${unit}${SEP}`
const SINGLE_NUMBER_SHAPE = numberSlot('')

// Colors are matched before numbers so the numbers inside rgb()/hsl() are not
// mistaken for standalone tokens. The unit group (index 1) is populated only
// for the number alternative.
const tokenPattern =
  /rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-fA-F]+|[+-]?(?:\d+\.?\d*|\.\d+)(px|%|em|rem|vw|vh|vmin|vmax|deg|rad|turn|s|ms)?/gi

const isColorText = (text: string): boolean => text[0] === '#' || /^(?:rgb|hsl)/i.test(text)

interface Decomposed {
  channels: number[]
  shape: string
  template: Template
}

// Test seam: the hot path (format) must never reach this.
let tokenizeCount = 0

const decompose = (raw: string): Decomposed | null => {
  tokenizeCount += 1
  const channels: number[] = []
  const tokens: Token[] = []
  const literals: string[] = []
  let shape = ''
  let cursor = 0
  for (const match of raw.matchAll(tokenPattern)) {
    const text = match[0]
    const index = match.index
    const literal = raw.slice(cursor, index)
    literals.push(literal)
    shape += literal
    cursor = index + text.length
    if (isColorText(text)) {
      const color = parseColor(text)
      if (color === null) return null
      channels.push(color[0], color[1], color[2], color[3])
      tokens.push({ kind: 'color' })
      shape += colorSlot
    } else {
      const unit = match[1] ?? ''
      const num = parseFloat(text)
      if (Number.isNaN(num)) return null
      channels.push(num)
      tokens.push({ kind: 'number', unit })
      shape += numberSlot(unit)
    }
  }
  if (tokens.length === 0) return null
  const tail = raw.slice(cursor)
  literals.push(tail)
  shape += tail
  return { channels, shape, template: { literals, tokens } }
}

// Templates are decoded from their shape string once and cached: the shape was
// produced by decompose, so it always round-trips. split on SEP yields
// alternating [literal, descriptor, literal, descriptor, ..., literal].
const templateCache = new Map<string, Template>()

const compileShape = (shape: string): Template => {
  const cached = templateCache.get(shape)
  if (cached !== undefined) return cached
  const parts = shape.split(SEP)
  const literals: string[] = []
  const tokens: Token[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? ''
    if (i % 2 === 0) literals.push(part)
    else if (part === 'c') tokens.push({ kind: 'color' })
    else tokens.push({ kind: 'number', unit: part.slice(2) })
  }
  const template: Template = { literals, tokens }
  templateCache.set(shape, template)
  return template
}

const channelMetas = (shape: string): ChannelMeta[] => {
  const { tokens } = compileShape(shape)
  const metas: ChannelMeta[] = []
  for (const token of tokens) {
    if (token.kind === 'color') metas.push(...COLOR_METAS)
    else metas.push(NUMBER_TOKEN_META)
  }
  return metas
}

/** Source channels grouped by kind, preserving order - the basis for kind-stable realignment. */
const groupByKind = (source: Decomposed): { numbers: number[]; colors: number[][] } => {
  const numbers: number[] = []
  const colors: number[][] = []
  let offset = 0
  for (const token of source.template.tokens) {
    if (token.kind === 'color') {
      colors.push(source.channels.slice(offset, offset + 4))
      offset += 4
    } else {
      numbers.push(source.channels[offset] ?? 0)
      offset += 1
    }
  }
  return { numbers, colors }
}

export const complexValueType: ValueType = {
  parse(raw) {
    if (typeof raw === 'number') {
      return Number.isFinite(raw) ? { channels: [raw], shape: SINGLE_NUMBER_SHAPE } : null
    }
    const decomposed = decompose(raw)
    return decomposed === null ? null : { channels: decomposed.channels, shape: decomposed.shape }
  },
  format(channels, shape) {
    const { literals, tokens } = compileShape(shape)
    let out = literals[0] ?? ''
    let offset = 0
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      if (token === undefined) break
      if (token.kind === 'color') {
        out += formatColor(channels.slice(offset, offset + 4))
        offset += 4
      } else {
        out += formatChannelNumber(channels[offset] ?? 0, NUMBER_TOKEN_META) + token.unit
        offset += 1
      }
      out += literals[i + 1] ?? ''
    }
    return out
  },
  channels(shape) {
    return channelMetas(shape)
  },
  reconcile(raw, targetShape) {
    const { tokens } = compileShape(targetShape)
    const trimmed = raw.trim().toLowerCase()
    // 'none' and an empty computed value (the unset initial: browsers serialize
    // box-shadow/filter as 'none', jsdom as '') both mean "no value yet".
    if (trimmed === 'none' || trimmed === '') {
      // Zero-equivalent of the target template: numbers collapse to 0, colors
      // to transparent (correct for the dominant black-shadow case).
      const channels: number[] = []
      for (const token of tokens) {
        if (token.kind === 'color') channels.push(0, 0, 0, 0)
        else channels.push(0)
      }
      return { channels, shape: targetShape }
    }
    const source = decompose(raw)
    if (source === null) return null
    const { numbers, colors } = groupByKind(source)
    let ni = 0
    let ci = 0
    const channels: number[] = []
    for (const token of tokens) {
      if (token.kind === 'color') {
        const color = colors[ci]
        if (color === undefined) return null
        channels.push(...color)
        ci += 1
      } else {
        const num = numbers[ni]
        if (num === undefined) return null
        channels.push(num)
        ni += 1
      }
    }
    // Exact count: leftover source tokens of either kind means the shapes are
    // structurally different (e.g. 1 shadow vs 2) - snap, do not pad.
    if (ni !== numbers.length || ci !== colors.length) return null
    return { channels, shape: targetShape }
  },
}

/** Test-only: number of full tokenizer passes (the hot path must add none). */
export function __tokenizeCount(): number {
  return tokenizeCount
}

/** Test-only: clears the template cache and the tokenizer counter. */
export function __resetComplexCaches(): void {
  templateCache.clear()
  tokenizeCount = 0
}
