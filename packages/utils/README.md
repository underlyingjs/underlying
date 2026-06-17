<p align="center">
  <img alt="underlying" src="https://underlyi.ng/wordmark-sapin.svg" width="280" />
</p>

<p align="center">
  <strong>Named eases and animation helpers for @underlying/core.</strong>
</p>

<p align="center">
  <a href="https://underlyi.ng"><img alt="docs" src="https://img.shields.io/badge/docs-underlyi.ng-1C3426" /></a>
  <img alt="utils gzip" src="https://img.shields.io/badge/utils-1.35%20kB%20gzip-1C3426" />
  <img alt="built on" src="https://img.shields.io/badge/built%20on-%40underlying%2Fcore-1C3426" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-1C3426" />
</p>


The named-ease and helpers layer for [`@underlying/core`](https://github.com/underlyingjs/underlying/tree/main/packages/core): the full named-ease library, `cubicBezier`, and the small helpers you reach for (`clamp`, `mapRange`, `interpolate`, `snap`, `wrap`, `random`). Tree-shakeable - you pay for what you import.

> Note: for **live** motion a spring already gives you overshoot and settle, physically. Named eases are for **baked** motion - a timed tween, a scrubbable timeline - and for porting existing named-ease code.

```sh
npm install @underlying/utils @underlying/core
```

## Eases

Every family - `power1`-`power4`, `sine`, `expo`, `circ`, `back`, `elastic`, `bounce`, `steps`, plus `cubicBezier` - is a plain function, so you can pass it straight in:

```ts
import { power2, back, elastic } from '@underlying/utils'

animate(card, { y: 0 }, { duration: 600, easing: power2.out })
animate(card, { y: 0 }, { duration: 600, easing: back.out })       // overshoot
animate(card, { y: 0 }, { duration: 900, easing: elastic.out })    // wobble
```

`back`, `elastic` and `steps` are configurable:

```ts
back(2).out            // stronger overshoot
elastic(1, 0.3).out    // amplitude, period
steps(5)               // a 5-step staircase
cubicBezier(0.25, 0.1, 0.25, 1)   // paste from any easing visualiser
```

`power1`-`power4` also carry their conventional names - `quad`, `cubic`, `quart`, `quint` are the same families (`quad === power1`, `cubic === power2`, `quart === power3`, `quint === power4`), so you can import whichever name reads better. `none` is the linear identity (`t => t`):

```ts
import { cubic, quint, none } from '@underlying/utils'

animate(card, { y: 0 }, { duration: 600, easing: cubic.inOut })   // same as power2.inOut
animate(card, { x: 0 }, { duration: 400, easing: none })          // constant rate, no curve
```

### Writing your own

A family is the three variants of one curve - the `EaseFamily` shape, where each `Easing` is `(t: number) => number`:

```ts
import type { EaseFamily } from '@underlying/utils'

const myEase: EaseFamily = {
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
}

animate(card, { y: 0 }, { duration: 600, easing: myEase.out })
```

## Named eases by string

Import the side-effect entry once and `@underlying/core` resolves ease names - so existing ease-name code ports across unchanged:

```ts
import '@underlying/utils/register'

animate(card, { y: 0 }, { duration: 600, easing: 'power2.out' })
animate(card, { y: 0 }, { duration: 900, easing: 'elastic.out(1, 0.3)' })
animate(card, { y: 0 }, { duration: 600, easing: 'cubicBezier(0.25, 0.1, 0.25, 1)' })
```

A name with no variant defaults to `.out` (by convention). An unknown name warns once and falls back, never throws.

The `/register` entry calls `registerEases()` for you (and also wires up `cubicBezier`). If you would rather register the named families explicitly - in app code, or without importing the side-effect entry - call it yourself:

```ts
import { registerEases } from '@underlying/utils'

registerEases()   // registers power1-4, quad/cubic/quart/quint, sine, expo, circ, back, elastic, bounce, steps, none/linear
```

## Helpers

```ts
import { clamp, mapRange, interpolate, snap, wrap, random, toArray, pipe } from '@underlying/utils'

clamp(value, 0, 1)
mapRange(scrollY, 0, 800, 0, 1)        // remap a range
interpolate(a, b, t)                    // lerp
snap(45, angle)                         // nearest multiple of 45
snap([0, 90, 180, 270], angle)          // nearest of a set
wrap(0, 360, angle + delta)             // carousels, angles
random(10, 20)                          // a number in [10, 20)
random(['a', 'b', 'c'])                 // a random element
toArray('.card')                        // selector / element / NodeList -> Element[]
pipe(addOne, double)                    // compose left to right
```

## License

MIT (c) underlyi.ng
