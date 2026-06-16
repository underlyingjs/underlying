/** Clamp a value into [min, max]. */
export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value

/** Remap a value from one range to another (does not clamp). */
export const mapRange = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => {
  const span = inMax - inMin
  return span === 0 ? outMin : outMin + ((value - inMin) / span) * (outMax - outMin)
}

/** Linear interpolation between a and b by t. */
export const interpolate = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * Snap a value to the nearest multiple of an increment, or to the nearest of a
 * set of stops.
 */
export function snap(increment: number, value: number): number
export function snap(stops: ReadonlyArray<number>, value: number): number
export function snap(target: number | ReadonlyArray<number>, value: number): number {
  if (typeof target === 'number') return target === 0 ? value : Math.round(value / target) * target
  let best = value
  let bestDistance = Number.POSITIVE_INFINITY
  for (const stop of target) {
    const distance = Math.abs(stop - value)
    if (distance < bestDistance) {
      bestDistance = distance
      best = stop
    }
  }
  return best
}

/** Wrap a value into [min, max) - a modulo that handles negatives (carousels, angles). */
export const wrap = (min: number, max: number, value: number): number => {
  const range = max - min
  return range === 0 ? min : (((value - min) % range) + range) % range + min
}

/** A random number in [min, max), or a random element of an array. */
export function random(min: number, max: number): number
export function random<T>(items: ReadonlyArray<T>): T
export function random<T>(a: number | ReadonlyArray<T>, b?: number): number | T {
  if (typeof a === 'number') return a + Math.random() * ((b ?? 0) - a)
  return a[Math.floor(Math.random() * a.length)] as T
}

/** Normalize a selector / element / NodeList / array into a flat array of elements. */
export function toArray<T extends Element = Element>(target: string | T | ArrayLike<T> | null | undefined): T[] {
  if (target === null || target === undefined) return []
  if (typeof target === 'string') {
    if (typeof document === 'undefined') return []
    return Array.from(document.querySelectorAll<T>(target))
  }
  if (target instanceof Element) return [target as T]
  return Array.from(target as ArrayLike<T>)
}

/** Compose unary functions left to right: pipe(f, g)(x) === g(f(x)). */
export const pipe =
  <T>(...fns: Array<(value: T) => T>) =>
  (value: T): T =>
    fns.reduce((accumulator, fn) => fn(accumulator), value)
