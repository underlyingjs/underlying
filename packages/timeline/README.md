<p align="center">
  <img alt="underlying" src="https://underlyi.ng/wordmark-sapin.svg" width="280" />
</p>

<p align="center">
  <strong>Seekable timelines, physics-shaped.</strong> Sequence motion with labels and
  <br />relative positions, nest timelines, and scrub the whole thing.
</p>

<p align="center">
  <a href="https://underlyi.ng"><img alt="docs" src="https://img.shields.io/badge/docs-underlyi.ng-1C3426" /></a>
  <img alt="timeline gzip" src="https://img.shields.io/badge/timeline-2.68%20kB%20gzip-1C3426" />
  <img alt="built on" src="https://img.shields.io/badge/built%20on-%40underlying%2Fcore-1C3426" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-1C3426" />
</p>

> Part of [underlying](https://github.com/underlyingjs/underlying), a physics-first motion library with first-class framework adapters (Angular first).

## Live vs baked - read this first

A timeline is a **score** you can scrub, reverse, and bind to scroll. To be seekable it must be addressable in time, and you cannot address a live simulation in time without recording it. So when a spring goes into a timeline, it is **baked**: the deterministic 1/120 s simulation runs to rest once and is recorded into a seekable table.

The motion stays **physics-shaped** - a baked spring is the exact trajectory a live one would draw, overshoot and settle included (not an eased curve). What you trade is live interruption: a clip inside a timeline is a recording, not a value you can retarget mid-flight.

So pick the tool:

- **Live, interruptible physics** (gestures, retargets, momentum) -> [`@underlying/core`](https://github.com/underlyingjs/underlying/tree/main/packages/core) and [`@underlying/scroll`](https://github.com/underlyingjs/underlying/tree/main/packages/scroll)'s momentum scrub.
- **A scrubbable, choreographed sequence** -> this package.

## Install

```sh
npm install @underlying/timeline
```

`@underlying/core` comes with it as a dependency.

## Quick start

```ts
import { animatable } from '@underlying/core'
import { timeline } from '@underlying/timeline'

const x = animatable(0)
const o = animatable(0)

const tl = timeline({ defaults: { duration: 600 } })
  .to(x, 280, { at: 0 })        // tween x: 0 -> 280, at t=0
  .to(o, 1, { at: '<' })        // fade in, starting WITH the slide ('<')
  .label('settled')             // name the cursor
  .spring(x, 320, { at: 'settled+=100', stiffness: 180 }) // baked spring, 100ms after 'settled'

// It IS a PlaybackHandle:
tl.duration()          // number (ms) - never undefined
tl.seek(650)           // synchronous: drives every value to its t=650 state
tl.progress(0.5)       // == seek(0.5 * duration())
tl.play().timeScale(2) // live playback at 2x, on the one rAF loop
```

## Authoring

```ts
timeline()
  .to(box.x, 120)                                   // from the current value to 120
  .from(title.y, -40, { duration: 500 })            // from -40 to the current value
  .fromTo(card.opacity, 0, 1, { at: '<' })          // explicit start and end
  .spring(hero.scale, 1.1, { stiffness: 200 })      // baked once at build
  .decay(banner.x, { velocity: 900, max: 320 })     // baked inertial glide to rest
  .stagger(cards, (c) => playable(c.y).to(0, { paused: true }), { each: 80, from: 'center' })
  .call(() => done(), '>')                          // a side-effect marker
  .add(otherTimeline, '+=200')                      // nest a timeline (it is a handle)
```

Sequential clips on one value chain from the prior clip's exit, velocity conserved at the seam.

`decay(value, options?)` drops a baked inertial glide: from the value's state at the clip start it coasts on `velocity` and slows on a `timeConstant` (ms), the same decay the core runs live. Because a timeline is seekable it bakes the glide to rest once, so `velocity` here is an explicit number, not a live hand-off. `DecayClipOptions` is `{ at?, duration?, easing? }` (the position grammar, plus the inherited tween defaults) merged with the core `DecayOptions`:

```ts
timeline().decay(box.x, {
  at: '<',              // position grammar, like every other verb
  velocity: 900,        // units/s the glide starts on (default: the value's current velocity)
  timeConstant: 325,    // ms; higher = longer glide. total distance ~ velocity * timeConstant
  min: 0, max: 320,     // optional clamp: crossing an edge turns the glide into a spring back to it
  restSpeed: 0.1,       // rest when |velocity| drops below this (units/s)
})
```

The `min` / `max` clamp is baked too: if the coast crosses an edge it springs back to it, and the whole bounded path is recorded into the seekable table.

## The position grammar

```
number            absolute ms (negative clamped to 0)
'250'             absolute ms (numeric string, same as the number)
'label'           a named position
'<' / '>'         start / end of the most-recently-added clip ('>' is the default)
'<N' / '>N'       prev start / end shifted by N ms (negative ok: '<-100')
'<+=N' / '>-=N'   same, explicit-sign form
'+=N' / '-=N'     N ms relative to the timeline END
'label+=N'        a label shifted by N ms
```

`label(name, at?)` names a position; `shiftCursor(to)` moves the insertion point without adding a clip.

## Introspection

Three read-only methods report the resolved schedule. Each forces a build (the schedule resolves and physics children bake) on first call, so the numbers are exact, not estimates.

```ts
tl.resolve('settled+=100')  // number: a Position resolved to absolute ms in this timeline
tl.labelTime('settled')     // number | undefined: a label's absolute ms (undefined if no such label)
tl.layout()                 // ReadonlyArray<{ start: number; duration: number }>: every child's frozen span
```

- `resolve(position)` runs any position through the same grammar the verbs use and returns absolute ms - the way to read where a `'<+=80'` or `'label-=50'` actually lands.
- `labelTime(name)` is the direct label lookup; `undefined` means the label was never set.
- `layout()` is the tooling and scroll-snap entry point: one `{ start, duration }` per child in build order, so you can place snap points or markers at clip boundaries without re-deriving the schedule.

## Scrub it with scroll

The master is a seekable `PlaybackHandle`, so [`@underlying/scroll`](https://github.com/underlyingjs/underlying/tree/main/packages/scroll) scrubs the whole timeline with no special-casing:

```ts
import { createScroll } from '@underlying/scroll'

const reveal = timeline().from(title.y, -40).to(subtitle.opacity, 1, '<')
createScroll().scrub(reveal)            // locked: progress follows scroll frame-for-frame
createScroll().scrub(reveal, { smooth: 0.3 }) // momentum
```

## Reduced motion

Honored through the core: a child built under `prefers-reduced-motion` settles instantly (zero duration), so the timeline's span shrinks and every value lands on its end state. The timeline adds no motion of its own.

## Notes

- `repeat` / `repeatDelay` / `yoyo` in the timeline options loop the WHOLE timeline. Infinite repeats live at the master level, never on a single clip.
- Overlapping clips on one value stack last-write-wins; keep clips on a shared value sequential.
- Build is lazy: the schedule resolves and physics children bake on the first `seek`/`play`/`progress`/`duration`, then freeze until the next `add()`.

## License

MIT © underlyi.ng
