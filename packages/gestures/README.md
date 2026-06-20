<p align="center">
  <img alt="underlying" src="https://underlyi.ng/wordmark-sapin.svg" width="280" />
</p>

<p align="center">
  <strong>Drag, fling and unify input - on live physics.</strong>
</p>

<p align="center">
  <a href="https://underlyi.ng"><img alt="docs" src="https://img.shields.io/badge/docs-underlyi.ng-1C3426" /></a>
  <img alt="gestures gzip" src="https://img.shields.io/badge/gestures-~2.41%20kB%20gzip-1C3426" />
  <img alt="built on" src="https://img.shields.io/badge/built%20on-%40underlying%2Fcore-1C3426" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-1C3426" />
</p>


Pointer gestures for [`@underlying/core`](https://github.com/underlyingjs/underlying/tree/main/packages/core). The hard part is the handoff: at release a gesture's velocity must flow into the motion seamlessly. Because every value in core carries its velocity, that handoff is one argument away. For layout and shared-element transitions, see [`@underlying/flip`](https://github.com/underlyingjs/underlying/tree/main/packages/flip).

```sh
npm install @underlying/gestures @underlying/core
```

## `draggable()`

Make an element draggable. During the drag the offset teleports to the pointer while a velocity tracker watches; on release that pointer velocity is handed straight into a spring, an inertial glide, or a momentum-aware snap - the element flies on the momentum you gave it, never a jump.

```ts
import { draggable } from '@underlying/gestures'

const drag = draggable(card, {
  axis: 'both',          // 'x' | 'y' | 'both' - which axes move (default 'both')
  lockAxis: true,        // commit to the dominant direction once the drag clears a few px
  bounds: viewport,      // an element to stay inside, or { x: [min, max], y: [min, max] }
  snap: { x: 120 },      // per-axis targets: an increment, explicit stops, or a resolver
  liveSnap: false,       // snap while dragging, not only on release (default false)
  edgeResistance: 0.82,  // rubber-band past the bounds, 0 = free .. 1 = a hard wall
  release: 'inertia',    // 'inertia' (glide + rubber-band) | 'spring' (back to origin) | 'free'
  spring: { stiffness: 200, damping: 26 },  // tuning for spring / snap / rubber-band release
  decay: { timeConstant: 325 },             // tuning for the inertial glide
  onStart: () => {},
  onEnd: ({ x, y }) => {}, // release velocity (px/s) per axis
})

drag.x // an Animatable - read it, retarget it, bind it elsewhere
drag.dispose()
```

The `x`/`y` offsets are plain `Animatable`s, so a drag composes with everything else: spring one to a snap point, feed it into a `follow()`, read its velocity.

`snap` takes a number (a grid increment), an array of explicit stops, or a `(value) => value` resolver per axis. With `release: 'inertia'` and `snap` set, the release projects where the momentum would land, snaps that, and springs there - a gentle drag steps one target, a hard flick skips several.

## `observe()`

One unified read of wheel, trackpad, pointer, and touch. It normalizes every input into the same stream - per-event deltas, accumulated totals, smoothed velocity, and a dominant axis - then fans that out to directional callbacks, a catch-all `onChange`, the raw `onWheel`/`onDrag`, and a debounced `onStop`. It is the single seam under scroll-jacking, swipe nav, and custom wheel/drag gestures. Pointer Events cover mouse, touch, and pen, so a drag works the same on every device.

```ts
import { observe } from '@underlying/gestures'

const obs = observe({
  target: field,              // an element or the window (default window)
  type: ['wheel', 'pointer'], // which inputs to unify (default all three)
  tolerance: 0,               // dead zone: px of accumulated travel before anything fires
  dragMinimum: 0,             // px of travel before a press becomes a drag
  wheelSpeed: 1,              // scale wheel deltas
  axis: 'y',                  // report only this axis (the other is zeroed)
  preventDefault: true,       // preventDefault handled events (wheel becomes non-passive)
  onChange: (s) => { value = clamp(value - s.deltaY * 0.2) },
})

obs.disable()    // remove the listeners, reset the accumulators
obs.enable()     // re-attach (observe() returns already enabled)
obs.isEnabled    // boolean
obs.dispose()    // disable for good
```

Every callback receives an `ObserverState`:

```ts
interface ObserverState {
  deltaX, deltaY: number       // this event's movement (px; wheel normalized to px)
  totalX, totalY: number       // accumulated since the gesture engaged
  velocityX, velocityY: number // smoothed velocity (px/s)
  axis: 'x' | 'y' | null       // dominant axis of the accumulated movement
  isDragging: boolean          // true while a pointer drag is in progress
  event: Event                 // the DOM event behind this report
}
```

The full callback set: `onPress`, `onRelease`, `onDrag`, `onWheel`, `onChange` (any engaged movement, from any input), the directional `onUp` / `onDown` / `onLeft` / `onRight`, and `onStop` (movement settled, debounced after the last event).

## `tilt()`

Tilt an element in 3D toward the cursor and spring it flat on leave. The pointer position over the element maps to two rotations a spring chases, so the card follows your cursor live and, when you leave, eases back to flat - interruptible, never a restart.

```ts
import { tilt } from '@underlying/gestures'

const t = tilt(card, { max: 14, scale: 1.04 }) // 14deg at the edges, a small lift
// t.rotateX / t.rotateY are live values - read them, bind them elsewhere, compose them
t.dispose()
```

Options: `max` (edge degrees, default 12), `perspective` (the `perspective()` depth in px, default 600), `scale` (a hover lift, default 1 = none), `reverse` (tilt away from the cursor), `spring`. It owns the element's transform (`perspective` + `rotateX` / `rotateY` + `scale`), and like `draggable`'s `x` / `y`, the rotations are live `Animatable`s you can read or reuse. Off on touch and held flat under reduced motion.

## `magnetic()`

Pull an element toward the cursor when it comes within range, and spring it home when the cursor leaves. The element follows a fraction of the cursor's offset from its centre, chased by a spring, so a button leans into the pointer and settles back - interruptible, never a restart.

```ts
import { magnetic } from '@underlying/gestures'

const m = magnetic(button, { strength: 0.4, radius: 140 }) // follow 40% of the offset, engage within 140px
// m.x / m.y are live Animatables - read them, bind them elsewhere, compose them
m.dispose()
```

Options: `radius` (engage distance from the centre in px, default half the element + 60), `strength` (fraction of the offset followed, default 0.3), `spring`. It tracks the pointer through one shared window listener (so many magnetic elements stay cheap), and like `draggable`'s `x` / `y`, the offset is exposed as live `Animatable`s. Off on touch and held home under reduced motion.

## `cursor()`

A custom cursor that trails the real pointer with spring lag and flips to an active state over interactive targets. The library only positions the element - you give it its look through CSS - so it stays a primitive, not a theme.

```ts
import { cursor } from '@underlying/gestures'

const c = cursor({ targets: 'a, button' }) // creates <div class="cursor"> on <body>
c.element // style .cursor and .cursor--active in your CSS; the library only moves it
c.dispose()
```

Options: `element` (drive your own instead of a created `<div>`), `className` (default `cursor`; the active state adds `cursor--active`), `targets` (selector that flips the active state), `spring` (the trailing lag). It rides the same shared pointer listener as `magnetic()`, and starts where the cursor already is rather than swooping in from the origin. Since it owns the element's transform, give the active swell to a child or `::before` (a `scale` of your own) so it never fights the position. Hidden on touch and under reduced motion - the native cursor stays.

## `depth()`

Pointer-driven depth parallax. A layer drifts by a fraction of the pointer's offset from a frame centre, chased by a spring; stack several layers with ascending `shift` and they read as depth - a 2.5D effect through plain transforms, no 3D engine.

```ts
import { depth } from '@underlying/gestures'

// One call per layer, rising shift = far -> near. They share one pointer listener.
depth(sky, { frame: hero, shift: 8, invert: true }) // far: barely, with the pointer
depth(panel, { frame: hero, shift: 22 }) // mid: against the pointer
const near = depth(title, { frame: hero, shift: 40 }) // near: leans more
// near.x / near.y are live Animatables - read them, bind them elsewhere, compose them
near.dispose()
```

Options: `shift` (travel in px at the frame edge, the depth magnitude; sign sets direction, default 24), `axis` (`'both'` / `'x'` / `'y'`; a single axis spends one spring instead of two), `invert` (`false` default = move against the pointer, the natural recession; `true` = with it), `frame` (`'viewport'` or an element, re-read each move so a scrolled hero stays correct), `clamp` (default true; cap travel at `+/-shift`), `spring`. The offset is exposed as live `Animatable`s like `draggable`'s `x` / `y`. Depth is faked through differential translate, so it owns the element's `x` / `y` transform: don't also run `tilt()` on the same element - each writes the whole transform string and they would clobber each other. Put them on nested elements, or read both sets of live values into a single `bindStyle` of your own. Off on touch and held flat under reduced motion.

## `quickTo()`

An imperative fast setter. Bind one (or two) of an element's transform channels to a spring once, then drive it every frame with a plain call. Each call re-aims the spring in place without rebuilding it, so it stays cheap in a hot handler. Where `cursor()` and `magnetic()` wire their own input, `quickTo()` is the escape hatch - you bring the handler and the mapping, it brings the physics.

```ts
import { quickTo } from '@underlying/gestures'

// Two channels through ONE bindStyle - calling quickTo twice on one element would
// clobber the transform, so pass them together.
const move = quickTo(glow, ['x', 'y'], { spring: { stiffness: 90 } })

panel.addEventListener('pointermove', (e) => {
  const r = panel.getBoundingClientRect()
  move(e.clientX - r.left, e.clientY - r.top) // cheap retarget; the spring is the lag
})

const fade = quickTo(card, 'opacity', { from: 1 }) // single channel -> fade.value, fade(0.4)
move.dispose()
```

Channels are any `bindStyle` key (`x`, `y`, `scale`, `rotate`, `opacity`, ...). Options: `from` (start value, per channel for a pair; default 0 - pass a non-zero start where 0 hides the element, `1` for `scale` or `opacity`), `spring`. The single-channel form exposes the live `value`; the pair form exposes `values` in channel order - read them, bind them elsewhere, compose them. Under reduced motion the value snaps to its target instead of springing, so motion is removed but tracking stays.

## `VelocityTracker`

The low-level helper both `draggable()` and `observe()` use to read pointer velocity. A first-order EMA over a ~50 ms window, made frame-rate independent; `read()` returns 0 when the last sample is older than 80 ms, so a finger that paused before lifting releases with no fling. Feed it the same clock (`event.timeStamp`) for `start` / `sample` / `read`. Exported for building your own gestures that hand off to core's springs.

```ts
import { VelocityTracker } from '@underlying/gestures'

const v = new VelocityTracker()
v.start(position, event.timeStamp)
v.sample(position, event.timeStamp)
const px_per_s = v.read(event.timeStamp)
```

## License

MIT (c) underlyi.ng
