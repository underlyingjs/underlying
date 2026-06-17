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
