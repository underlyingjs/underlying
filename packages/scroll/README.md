<p align="center">
  <img alt="underlying" src="https://underlyi.ng/wordmark-sapin.svg" width="280" />
</p>

<p align="center">
  <strong>Scroll-driven animation, physics-first.</strong> Scroll is a source, not an engine -
  <br />locked or momentum scrub, parallax, scroll-velocity, pin, snap, and triggers, on the one rAF loop.
</p>

<p align="center">
  <a href="https://underlyi.ng"><img alt="docs" src="https://img.shields.io/badge/docs-underlyi.ng-1C3426" /></a>
  <img alt="scroll gzip" src="https://img.shields.io/badge/scroll-5.50%20kB%20gzip-1C3426" />
  <img alt="built on" src="https://img.shields.io/badge/built%20on-%40underlying%2Fcore-1C3426" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-1C3426" />
</p>

> Part of [underlying](https://github.com/underlyingjs/underlying), a physics-first motion library with first-class framework adapters (Angular first).

## Why

- **Scroll as a source, not an engine.** This package owns the three browser concerns `@underlying/core` refuses - one `IntersectionObserver`, one passive scroll/resize listener, and `getBoundingClientRect` - turns scroll into a normalized `0..1`, and fans it onto the core's existing seams. No physics is re-implemented.
- **Locked or momentum, one field.** `smooth: false` locks the playhead to the scroll frame-for-frame (reversible, deterministic). A number routes through `follow()`, so the motion lags the scroll by that many seconds with conserved velocity.
- **Composed, not bolted on.** Scrub drives the seekable `PlaybackHandle.progress()`; parallax returns a `bindStyle`-ready `Animatable`; everything runs on the same scheduler tick as the rest of your motion.
- **Accessible by default.** One reduced-motion policy: momentum scrub collapses to locked, parallax is disabled, momentum snap goes instant - re-routed live when the OS preference changes.
- **SSR-safe and lazy.** Nothing touches browser globals at import; the source is created on the first `track()`/builder call. Never scroll-jacking.

## Install

```sh
npm install @underlying/scroll
```

`@underlying/core` comes with it as a dependency; scroll shares its one rAF loop and value model.

## Quick start

```ts
import { createScroll } from '@underlying/scroll'
import { animatable, bindStyle, linear } from '@underlying/core'
import { playable } from '@underlying/core/playback'

const scroll = createScroll() // viewport, y-axis, shared scheduler

// Locked scrub: scroll position drives a seekable handle, frame-for-frame.
// A linear tween maps the scroll straight to progress (no ease-in on top).
const x = animatable(0)
bindStyle(panel, { x })
const clip = playable(x).to(600, { paused: true, easing: linear })
scroll.scrub(clip, { target: panel })            // smooth: false (default)
```

## Scrub - locked or momentum

```ts
// Momentum: the handle trails the scroll by ~0.2s, velocity conserved.
scroll.scrub(clip, { target: panel, smooth: 0.2 })

// A live spring is seekable only after bake(); scrub does it once at link time.
const spring = playable(y).spring(800, { paused: true })
scroll.scrub(spring, { target: hero, smooth: 0.3 })

// A raw callback is always locked (nothing to seek).
scroll.scrub((p) => { label.textContent = `${(p * 100) | 0}%` })
```

## Parallax

```ts
// Returns an Animatable - hand it straight to bindStyle.
const bgY = scroll.parallax({ target: section, output: [-120, 120] })
bindStyle(bg, { y: bgY })

const lead = scroll.parallax({ target: section, output: [60, -60], smooth: 0.15 })
bindStyle(foreground, { y: lead })
```

## Velocity - lean with scroll speed

`velocity()` exposes how fast the scroller is moving as one `bindStyle`-ready value (px/s, signed), smoothed through a spring so it ramps and eases back to rest the moment you stop. Map it to a few degrees of skew, a scale, or a blur for the speed-reactive lean.

```ts
// raw signed px/s -> a few degrees, clamped; relaxes to 0 when scrolling stops
const skew = scroll.velocity({ map: (v) => Math.max(-8, Math.min(8, v * 0.02)) })
bindStyle(content, { skewY: skew })
```

Physics-first: a spring owns the relax, so a fresh flick mid-relax re-aims it with velocity conserved, never a restart. `smooth` (seconds) tunes the ramp/relax; `spring` overrides the follow config. Disabled under reduced motion (held at `map(0)`).

## Pin

```ts
// Wrap in a spacer, position:fixed across the range. pin.track is the progress
// THROUGH the pinned span - feed it to a nested scrub.
const pin = scroll.pin(panel, { range: ['start start', 'bottom bottom'] })

const cap = animatable(0)
bindStyle(caption, { opacity: cap })
scroll.scrub(playable(cap).to(1, { paused: true, easing: linear }), { track: pin.track })
```

## Triggers

```ts
import { playable } from '@underlying/core/playback'

// Enter/leave via IntersectionObserver; direction read from the entry geometry.
scroll.trigger(card, {
  onEnter: () => card.classList.add('in'),
  onLeaveBack: () => card.classList.remove('in'),
})

// Or drive a PlaybackHandle with toggleActions verbs
// [onEnter, onLeave, onEnterBack, onLeaveBack].
scroll.trigger(card, { toggle: clip, toggleActions: ['play', 'pause', 'resume', 'reverse'] })
```

## scrollTo - spring the scroller to a target

```ts
// Spring the scroller to an absolute px position or an element brought into
// view. Returns a ScrollToHandle - { finished, cancel() }.
const handle = scroll.scrollTo(section, { offset: -80 })  // land 80px below the top
await handle.finished                                     // resolves on arrival

// align picks which '<elementEdge> <viewportEdge>' pair to bring together.
// Default 'start start' - the section's top lands at the viewport top.
scroll.scrollTo(section, { align: 'center center', offset: -44 })

// One follow() is shared across calls, so a scrollTo issued mid-flight RE-AIMS
// the spring already in motion - velocity conserved, no restart jolt. Pass your
// own spring, or immediate for a hard jump (always on under reduced motion).
scroll.scrollTo(1200, { spring: { stiffness: 120 } })
scroll.scrollTo(0, { immediate: true })

handle.cancel()  // freeze the scroller where it is; finished resolves
```

`scrollTo()` never aims past the reachable range, and the handle's `finished`
never rejects - it resolves on arrival, or when the scroll is canceled or
superseded by a later call.

## Snap

```ts
// Opt-in momentum snap. On scroll-idle it springs to the nearest stop in the
// direction you were scrolling. CSS scroll-snap stays the recommended default.
scroll.snap({ to: 0.25 })                          // a stop every 25%
scroll.snap({ to: [0, 0.4, 1] })                   // explicit stops
scroll.snap({ to: (p, direction) => /* ... */ })   // custom resolver
```

## Track - the raw primitive

```ts
// Everything above composes from this: normalized 0..1 over a range, deduped.
const t = scroll.track({ target: section })
t.progress()                 // read synchronously
t.on((p) => render(p))       // or subscribe

scroll.dispose()             // tears down the loop, observers, and every binding
```

## More on the controller

```ts
// markers(): dev-only overlay for a range. Solid lines travel with the content
// (the element's enter/leave edges); dashed lines are the fixed scroller
// positions they fire against. When a solid meets a dashed of the same colour,
// that edge fires. Reads the DOM live - never ship it on.
const m = scroll.markers({ target: section, label: 'hero' })
m.dispose()

// progress(): whole-scroller progress 0..1 (scrollPos / maxScroll), read
// synchronously. Cheaper than a track() when you only need the page fraction.
scroll.progress()

// refresh(): re-measure every registered track. Call after a layout change the
// controller can't observe (a font swap, an image load, a panel that expands).
scroll.refresh()
```

## SSR and tests

Nothing touches browser globals at import, and the DOM source is created lazily
on the first builder call. For server rendering or a headless test, inject a
deterministic source with `createManualScrollSource()` and drive it by hand -
the same seam the core exposes with its manual driver.

```ts
import { createScroll, createManualScrollSource } from '@underlying/scroll'

const source = createManualScrollSource({ viewportSize: 800, maxScroll: 2000 })
const scroll = createScroll({ source })

source.setBox(section, { start: 1000, size: 600 }) // place an element (content coords)
source.emitScroll(500)                             // move the scroll, fire listeners
source.emitResize()                                // trigger a re-measure pass
scroll.progress()                                  // assert against a known number
```

## The offset grammar

Ranges use the `[element edge] [viewport edge]` offset model. The
default is `['start end', 'end start']` - progress `0` when the element's start
edge meets the viewport's end, `1` when its end edge meets the viewport's start.

```ts
scroll.track({ target: el, range: ['start center', 'end center'] })
```

## Reduced motion

Honored automatically (consulting the core's `prefers-reduced-motion` state): a
locked scrub stays (it is user-driven and safe), a momentum scrub collapses to
locked, parallax is disabled at its resting transform, and a momentum snap
becomes an instant jump. The policy re-routes live when the preference changes.

## License

MIT © underlyi.ng
