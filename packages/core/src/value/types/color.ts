import { formatChannelNumber, type ChannelMeta, type ValueType } from '../value-type'

// Colors decompose into [r^2, g^2, b^2, a]: storing the channels squared means a
// per-channel linear spring runs in gamma-2.0 (approximate linear-light) space,
// which IS the mix - no dark sRGB midpoint, no separate color-mixing pass.
// `sqrt` + clamp + integer round happen only at format. Oklab/OKLCH ship later as
// @underlying/color via registerValueType.
//
// Rest tolerances are scaled to the squared magnitude (0..65025): 40 / 400 is
// roughly 0.16 sRGB steps at midrange, so the loop sleeps at visual rest rather
// than chasing px-tuned defaults for seconds.
const RGB_META: ChannelMeta = { precision: 0, min: 0, max: 65025, restDelta: 40, restSpeed: 400 }
const ALPHA_META: ChannelMeta = { precision: 4, min: 0, max: 1, restDelta: 0.005, restSpeed: 0.05 }
export const COLOR_METAS: readonly ChannelMeta[] = [RGB_META, RGB_META, RGB_META, ALPHA_META]

/** The single color shape: 4 channels, one canonical rgba layout. */
export const COLOR_SHAPE = 'rgba'

const sqrtByte = (squared: number): number => {
  const clamped = squared < 0 ? 0 : squared > 65025 ? 65025 : squared
  return Math.round(Math.sqrt(clamped))
}

/** Channels [r^2, g^2, b^2, a] -> canonical, byte-stable `rgba(R, G, B, A)`. */
export function formatColor(channels: readonly number[]): string {
  const r = sqrtByte(channels[0] ?? 0)
  const g = sqrtByte(channels[1] ?? 0)
  const b = sqrtByte(channels[2] ?? 0)
  const a = formatChannelNumber(channels[3] ?? 1, ALPHA_META)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

const hexComponent = (hex: string): [number, number, number, number] | null => {
  if (!/^[0-9a-f]+$/.test(hex)) return null
  // Expand the 3/4-digit short form: 'f04' -> 'ff0044'.
  const full = hex.length === 3 || hex.length === 4 ? hex.replace(/./g, (c) => c + c) : hex
  if (full.length !== 6 && full.length !== 8) return null
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  const a = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1
  return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) || Number.isNaN(a) ? null : [r, g, b, a]
}

const functionalArgs = (s: string): string[] | null => {
  const open = s.indexOf('(')
  const close = s.lastIndexOf(')')
  if (open < 0 || close < open) return null
  return s
    .slice(open + 1, close)
    .split(/[\s,/]+/)
    .filter((part) => part !== '')
}

const component = (raw: string, scale: number): number =>
  raw.endsWith('%') ? (parseFloat(raw) / 100) * scale : parseFloat(raw)

const rgbComponent = (s: string): [number, number, number, number] | null => {
  const parts = functionalArgs(s)
  if (parts === null || parts.length < 3 || parts.length > 4) return null
  const [p0, p1, p2, p3] = parts
  if (p0 === undefined || p1 === undefined || p2 === undefined) return null
  const r = component(p0, 255)
  const g = component(p1, 255)
  const b = component(p2, 255)
  const a = p3 === undefined ? 1 : component(p3, 1)
  return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) || Number.isNaN(a) ? null : [r, g, b, a]
}

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = ((((h % 360) + 360) % 360) / 60)
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x]
  const m = l - c / 2
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255]
}

const hslComponent = (s: string): [number, number, number, number] | null => {
  const parts = functionalArgs(s)
  if (parts === null || parts.length < 3 || parts.length > 4) return null
  const [p0, p1, p2, p3] = parts
  if (p0 === undefined || p1 === undefined || p2 === undefined) return null
  const h = parseFloat(p0)
  const sat = parseFloat(p1) / 100
  const light = parseFloat(p2) / 100
  const a = p3 === undefined ? 1 : component(p3, 1)
  if (Number.isNaN(h) || Number.isNaN(sat) || Number.isNaN(light) || Number.isNaN(a)) return null
  const [r, g, b] = hslToRgb(h, sat, light)
  return [r, g, b, a]
}

// Reused, in-document probe: detached elements have no computed style, so the
// element must live in the tree. display:none is fine - `color` is not
// layout-dependent. Created lazily on the first named candidate (SSR-safe).
let probe: HTMLElement | null = null
const NON_COLOR_KEYWORDS = new Set([
  'none', 'auto', 'inherit', 'initial', 'unset', 'revert', 'currentcolor', 'transparent',
])

const namedComponent = (name: string): [number, number, number, number] | null => {
  if (NON_COLOR_KEYWORDS.has(name)) return null
  if (typeof document === 'undefined') return null
  if (probe === null) {
    probe = document.createElement('div')
    probe.style.display = 'none'
    document.documentElement.appendChild(probe)
  }
  probe.style.color = ''
  probe.style.color = name
  // An invalid keyword is rejected by the CSSOM: the assignment leaves it empty.
  if (probe.style.color === '') return null
  return rgbComponent(getComputedStyle(probe).color)
}

/** Decompose a color into squared-sRGB channels [r^2, g^2, b^2, a]. null = not a parseable color. */
export function parseColor(raw: string | number): [number, number, number, number] | null {
  if (typeof raw === 'number') return null
  const s = raw.trim().toLowerCase()
  if (s === '') return null
  if (s === 'transparent') return [0, 0, 0, 0]
  const rgba =
    s[0] === '#'
      ? hexComponent(s.slice(1))
      : s.startsWith('rgb')
        ? rgbComponent(s)
        : s.startsWith('hsl')
          ? hslComponent(s)
          : /^[a-z]+$/.test(s)
            ? namedComponent(s)
            : null
  if (rgba === null) return null
  const [r, g, b, a] = rgba
  return [r * r, g * g, b * b, a]
}

export const colorValueType: ValueType = {
  spatial: false,
  parse(raw) {
    const channels = parseColor(raw)
    return channels === null ? null : { channels, shape: COLOR_SHAPE }
  },
  format(channels) {
    return formatColor(channels)
  },
  channels() {
    return COLOR_METAS
  },
}

/** Test-only: drops the cached probe element so a fresh document can be used. */
export function __resetColorProbe(): void {
  probe?.remove()
  probe = null
}
