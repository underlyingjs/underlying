<p align="center">
  <img alt="underlying" src="https://underlyi.ng/wordmark-sapin.svg" width="280" />
</p>

<p align="center">
  <strong>Physics-first web animation.</strong> Interruptible by design, accessible by default,
  <br />zero dependencies. The full surface is 10.07 kB gzip; the primitives alone
  <br />(animatable + bindStyle + physics, no value model) tree-shake to 3.04 kB.
</p>

<p align="center">
  <a href="https://underlyi.ng"><img alt="docs" src="https://img.shields.io/badge/docs-underlyi.ng-1C3426" /></a>
  <img alt="full surface gzip" src="https://img.shields.io/badge/full%20surface-10.07%20kB%20gzip-1C3426" />
  <img alt="primitives gzip" src="https://img.shields.io/badge/primitives-3.04%20kB%20gzip-1C3426" />
  <img alt="dependencies" src="https://img.shields.io/badge/deps-0-1C3426" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-1C3426" />
</p>

> Part of [underlying](https://github.com/underlyingjs/underlying), a physics-first motion library with first-class framework adapters (Angular first).

## Why

- **Physical by default.** No hardcoded durations, no cubic-bezier guesswork. Springs, inertia and decay drive the motion; duration/easing exists as an escape hatch, not the other way around.
- **Interruptible by design.** Every animated value knows its position *and its velocity*. Retargeting mid-flight continues the motion seamlessly - never a jump, never a restart.
- **Accessible natively.** `prefers-reduced-motion` is respected with zero configuration (skip or fade, configurable), reacts to mid-session OS changes, and supports app-level overrides.
- **One rAF loop.** Every animation batches into a single scheduler tick - simulations first, style writes after. WAAPI is used opportunistically (eligible duration tweens ride the compositor) and hands control back losslessly on interruption.
- **Deterministic.** Fixed-timestep simulation (1/120 s): the same inputs produce the same trajectory at 60, 120 or 144 Hz.

## Install

```sh
npm install @underlying/core
```

## Bundle size

All numbers are measured gzip (level 9) on the built ESM bundle, tree-shaken:

| Import | gzip | What it pulls in |
| --- | --- | --- |
| Full surface (`import * as core`) | 10.07 kB | everything the package entry exports |
| Primitives only (`animatable` + `bindStyle` + physics) | 3.04 kB | no value model - the registry and CSS parsers stay tree-shaken |
| `animate()` import graph | 9.04 kB | `animate()` deliberately pulls the registry and the four built-in value parsers |
| `@underlying/core/playback` | 5.36 kB | net cost on top of a core you already ship (it imports the shared core chunk) |

The split is real: if you only ever touch `animatable`/`bindStyle`/`simulate`, you
ship none of the value model. Reaching for `animate()` opts you into the registry
and the length/color/complex/number parsers.

## Quick start

```ts
import { animatable, bindStyle } from '@underlying/core'

const x = animatable(0)
bindStyle(element, { x })

x.spring(300)                  // physical motion toward 300
x.spring(0)                    // retarget mid-flight: velocity is conserved
x.velocity()                   // readable at any time, in units/s

// Gesture handoff: release a drag into a spring or an inertial glide
x.spring(0, { velocity: gestureVelocity })
x.decay({ velocity: gestureVelocity, min: 0, max: 800 })  // rubber-band edges

// Escape hatch when you really need a duration
x.to(300, { duration: 300, easing: (t) => t })
```

Every animation method returns a handle:

```ts
const handle = x.spring(100)
await handle.finished          // resolves at rest or on interruption - never rejects
handle.stop()                  // freeze in place; position AND velocity stay readable
```

## Element-level API

```ts
import { animate, stagger, chain } from '@underlying/core'

animate(el, { x: 100, opacity: 0 })              // springs by default
animate(el, { x: 100 }, { duration: 400 })       // tween - delegated to WAAPI when free

chain([
  () => animate(title, { opacity: 1 }),
  () => stagger(items, (item) => animate(item, { y: 0 }), 60),
])
```

Repeated `animate()` calls on the same element retarget the same underlying
values - interruption with velocity conservation, not parallel animations.

## Playback (opt-in)

Springs stay live; tweens are seekable. `@underlying/core/playback` is a separate
bundle entry (5.36 kB gzip net on top of the core) that adds pause / timeScale /
reverse / seek, a `bake()` bridge that samples a spring into a scrubbable clip,
`follow()` for momentum scrub, and `sequence()` - the live, interruptible twin of
`@underlying/timeline` (a cascade you grab mid-flight, not a baked table you scrub).
The same entry exports `animatePlayback()` (the playback-aware twin of `animate()`)
and `timeScope()` (a child scheduler whose `pause()` / `timeScale` dilate every
animation inside it - the time-dilation seam the whole layer rides on).

```ts
import { playable, follow, sequence } from '@underlying/core/playback'

const motion = playable(value).spring(300)
motion.pause().timeScale(0.25)            // slow-mo, identical trajectory shape
if (motion.bake()) motion.progress(0.5)   // a live spring, now scrubbable

const lag = follow(0)                     // a value that springs toward a moving target
onScroll((y) => lag.target(y))            // momentum scrub, conserved velocity

sequence().spring(a, 1).spring(b, 1, { overlap: 80 }).play()  // live cascade, interruptible
```

## Transform channels

The transform is driven as separate live channels: `x`, `y`, `scale`, `rotate`,
plus `perspective`, `rotateX/Y/Z`, `skewX/Y`, `scaleX/Y`, and the pivot `originX` /
`originY` (transform-origin). Each is its own interruptible spring, so a 3D card
flip retargets mid-flight like any value. `perspective` is the `perspective()`
function on the element itself - set it rather than spring it from nothing; and
`transform-style: preserve-3d` is a CSS mode you put on the scene.

```ts
animate(card, { rotateY: 180 })                  // a real spring, interruptible
animate(panel, { rotateX: 20, skewX: 6, scaleX: 1.2 })
animate(square, { originX: 0, originY: 0 })       // animate the pivot
```

## Any CSS property, colors, units

Beyond those transform/opacity channels, `animate()` accepts any CSS property
(and custom properties) as a string or number. Values decompose into scalar
channels - each an interruptible spring - and reformat to a CSS string every
frame.

```ts
animate(panel, { width: '50%' })                 // computed px -> % : one measurement, velocity rebased
animate(button, { backgroundColor: '#10b981' })  // hex/rgb()/hsl()/named, mixed in gamma-2.0 space
animate(button, { outlineColor: 'rebeccapurple' })
animate(card, { boxShadow: '0px 12px 32px rgba(0, 0, 0, 0.35)' })  // composite: numbers + colors
animate(meter, { '--progress': 0.8 })            // custom property
```

Units convert by measuring once at the start (`240px` retargeted to `50%`
rebases position *and* velocity). Unconvertible or unparseable values snap to
the target with a one-time console warning, never a throw.

## Keyframes

```ts
animate(badge, { x: [null, 120, 80] })                  // null = from the current value
animate(badge, { x: [0, 120, 80] }, { duration: 600 })  // explicit 0 = teleport start
```

Without a duration the waypoints are chained springs (settle at each, then
retarget); with a duration they become an evenly-split piecewise tween that
rides the compositor (WAAPI multi-keyframe) when eligible.

## Entrances - `from()` / `fromTo()`

Animate _into_ a resting state instead of out of one, with no manual `setStyle`
first. The from-state is parked synchronously in the call frame (no flash), then
the element springs to its target:

```ts
import { from, fromTo } from '@underlying/core'

from(card, { y: 24, opacity: 0 })                 // rises into its NATURAL resting state
fromTo(card, { y: 24, opacity: 0 }, { y: 0, opacity: 1 }) // explicit from and to
```

`from()` captures each element's current value per key as the to-state, so a set
returns to _its own_ resting values. `fromTo()` is sugar over
`animate(target, to, { from })` - the `to` keeps full target parity (keyframes,
relative `'+='`, per-target functions); the from-state is one value per key.

Both share every `animate()` option. With a stagger `delay` (or `staggerDelay()`)
every element is parked at its from-state immediately and holds it through its own
delay, like a real entrance:

```ts
from('.card', { y: 24, opacity: 0 }, { delay: staggerDelay({ each: 60 }) })
```

Under reduced motion the from-set is skipped entirely: the element settles at its
target, never stranded at the from-state.

## Teleport & gesture handoff

```ts
import { setStyle, releaseStyle } from '@underlying/core'

const onDrag = (px: number) => setStyle(panel, { width: `${px}px` })       // coherent teleport
const onRelease = (px: number, v: number) => {
  setStyle(panel, { width: `${px}px` }, { velocity: v })                   // seed gesture momentum
  animate(panel, { width: '50%' })                                         // spring inherits it
}

releaseStyle(panel)  // forget the element: dispose channels, remove our inline styles, start cold next time
```

## Custom physics

Spring, decay, and tween are presets over one primitive: a `Simulation` - an
acceleration plus a rest condition. `value.simulate()` runs anything on the same
fixed-timestep clock, from the current position and velocity, fully interruptible.

```ts
import { animatable } from '@underlying/core'

// gravity plus a damped floor: an accelerating fall, a decaying bounce
const bounce = {
  acceleration: (pos, vel) => (pos > floor ? G - K * (pos - floor) - C * vel : G),
  rest: (pos, vel) => (pos >= floor && Math.abs(vel) < 3 ? floor : null),
}
const y = animatable(0)
y.simulate(bounce)   // the same engine behind spring/decay/to
```

For physics that is not bound to an `Animatable` - a canvas particle system,
confetti, a 2D field - reach for the `@underlying/core/physics` subpath. It is the
bring-your-own-loop seam: `stepSimulation(sim, state, dt)` is the single
semi-implicit Euler step the whole engine runs on, and `SIMULATION_TIMESTEP_S`
(1/120 s) is the fixed timestep to drive it with.

```ts
import { stepSimulation, SIMULATION_TIMESTEP_S, type Simulation } from '@underlying/core/physics'

let state = { position: 0, velocity: 0 }
state = stepSimulation(simulation, state, SIMULATION_TIMESTEP_S)  // your loop, your render
```

## Easing

Springs need no easing, but the duration escape hatch (`{ duration }`) takes an
`easing`. Pass a function, or a named ease by string. `easeInCubic`,
`easeOutCubic`, `easeInOutCubic`, and `linear` are exported straight from
`@underlying/core`. The named ease families (`power2.out`, `elastic.out(1, 0.3)`,
`steps(...)`, ...) live in `@underlying/utils`; a one-time
`import '@underlying/utils/register'` registers them so the string forms resolve.
Wire your own with `registerEasing(name, factory)`, or resolve a string yourself
with `resolveEasing(input)`.

```ts
import { animate, easeOutCubic } from '@underlying/core'
import '@underlying/utils/register'  // registers the named ease families (once)

animate(box, { x: 300 }, { duration: 400, easing: easeOutCubic })
animate(box, { x: 0 }, { duration: 400, easing: 'elastic.out(1, 0.3)' })
```

## Custom value types

The registry is the extension point for the package family (and your app):

```ts
import { registerValueType, numberValueType } from '@underlying/core'

registerValueType(['--progress'], numberValueType)  // explicit, never at import time
```

## Reduced motion

Active with zero configuration: under `prefers-reduced-motion`, animations
fast-forward to their exact rest state (even bounded inertia lands on its edge).

```ts
import { setReducedMotionBehavior, setReducedMotionOverride } from '@underlying/core'

setReducedMotionBehavior('fade')      // movement snaps, opacity still animates
setReducedMotionOverride(true)        // app-level toggle (null = follow the OS)
x.spring(100, { reducedMotion: 'allow' })  // essential, gesture-driven motion
```

## License

MIT © underlyi.ng
