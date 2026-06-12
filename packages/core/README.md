# @underlying/core

**Physics-first web animation.** Interruptible by design, accessible by default, zero dependencies, **< 10 kB gzip** (currently ~4 kB).

> Beta - the API may still move before 1.0. Built as the foundation of [underlying](https://github.com/underlyingjs/underlying), a physics-first motion library with first-class framework adapters (Angular first).

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

MIT © Erwan Soubeyrand
