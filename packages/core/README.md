<p align="center">
  <img alt="underlying" src="https://underlyi.ng/wordmark-sapin.svg" width="280" />
</p>

<p align="center">
  <strong>Physics-first web animation.</strong> Interruptible by design, accessible by default,
  <br />zero dependencies, ~9.5 kB gzip (a transforms-only import tree-shakes to ~2.4 kB).
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@underlying/core"><img alt="npm" src="https://img.shields.io/npm/v/@underlying/core?label=npm&color=1C3426" /></a>
  <a href="https://underlyi.ng"><img alt="docs" src="https://img.shields.io/badge/docs-underlyi.ng-1C3426" /></a>
  <img alt="core gzip" src="https://img.shields.io/badge/core-~9.5%20kB%20gzip-1C3426" />
  <img alt="dependencies" src="https://img.shields.io/badge/deps-0-1C3426" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-1C3426" />
</p>

> Beta - the API may still move before 1.0. Part of [underlying](https://github.com/underlyingjs/underlying), a physics-first motion library with first-class framework adapters (Angular first).

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
import { animate, stagger, sequence } from '@underlying/core'

animate(el, { x: 100, opacity: 0 })              // springs by default
animate(el, { x: 100 }, { duration: 400 })       // tween - delegated to WAAPI when free

sequence([
  () => animate(title, { opacity: 1 }),
  () => stagger(items, (item) => animate(item, { y: 0 }), 60),
])
```

Repeated `animate()` calls on the same element retarget the same underlying
values - interruption with velocity conservation, not parallel animations.

## Playback (opt-in)

Springs stay live; tweens are seekable. `@underlying/core/playback` is a separate
bundle entry (~4.3 kB gzip on top of the core) that adds pause / timeScale /
reverse / seek, a `bake()` bridge that samples a spring into a scrubbable clip,
and `follow()` for momentum scrub.

```ts
import { playable, follow } from '@underlying/core/playback'

const motion = playable(value).spring(300)
motion.pause().timeScale(0.25)            // slow-mo, identical trajectory shape
if (motion.bake()) motion.progress(0.5)   // a live spring, now scrubbable

const lag = follow(0)                     // a value that springs toward a moving target
onScroll((y) => lag.target(y))            // momentum scrub, conserved velocity
```

## Any CSS property, colors, units

Beyond the five transform/opacity channels, `animate()` accepts any CSS property
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
the target with a one-time dev warning, never a throw.

## Keyframes

```ts
animate(badge, { x: [null, 120, 80] })                  // null = from the current value
animate(badge, { x: [0, 120, 80] }, { duration: 600 })  // explicit 0 = teleport start
```

Without a duration the waypoints are chained springs (settle at each, then
retarget); with a duration they become an evenly-split piecewise tween that
rides the compositor (WAAPI multi-keyframe) when eligible.

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
