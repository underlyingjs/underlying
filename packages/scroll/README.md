<p align="center">
  <img alt="underlying" src="https://underlyi.ng/wordmark-sapin.svg" width="280" />
</p>

<p align="center">
  <strong>Scroll-driven animation, physics-first.</strong> Scroll is a source, not an engine -
  <br />locked or momentum scrub, parallax, pin, snap, and triggers, on the one rAF loop.
</p>

<p align="center">
  <a href="https://underlyi.ng"><img alt="docs" src="https://img.shields.io/badge/docs-underlyi.ng-1C3426" /></a>
  <img alt="scroll gzip" src="https://img.shields.io/badge/scroll-~4%20kB%20gzip-1C3426" />
  <img alt="built on" src="https://img.shields.io/badge/built%20on-%40underlying%2Fcore-1C3426" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-1C3426" />
</p>

> Beta - the API may still move before 1.0. Part of [underlying](https://github.com/underlyingjs/underlying), a physics-first motion library with first-class framework adapters (Angular first).

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
