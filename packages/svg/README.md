<p align="center">
  <img alt="underlying" src="https://underlyi.ng/wordmark-sapin.svg" width="280" />
</p>

<p align="center">
  <strong>Ride an element along a path, or draw a stroke on - on live physics.</strong>
</p>

<p align="center">
  <a href="https://underlyi.ng"><img alt="docs" src="https://img.shields.io/badge/docs-underlyi.ng-1C3426" /></a>
  <img alt="svg gzip" src="https://img.shields.io/badge/svg-~1.6%20kB%20gzip-1C3426" />
  <img alt="built on" src="https://img.shields.io/badge/built%20on-%40underlying%2Fcore-1C3426" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-1C3426" />
</p>

> Beta. The API may still move before 1.0.

SVG path animation for [`@underlying/core`](https://github.com/underlyingjs/underlying/tree/main/packages/core) - MotionPath, DrawSVG, and a resampling morph. The progress of each is a single live value, so where other libraries bake a path tween, here you can flick a marker down a path and let it settle, interrupt a stroke mid-draw, scrub a morph, or hand the same progress to scroll. No new engine: it samples the path with the native `getPointAtLength`/`getTotalLength` and drives core's `animatable`.

```sh
npm install @underlying/svg @underlying/core
```

## `motionPath()`

Ride an element along a path. Progress `t` is a live `Animatable`, so spring it, flick it, or retarget it mid-flight - velocity is conserved across the change. `autoRotate` turns the element to face along the path.

```ts
import { motionPath } from '@underlying/svg'

const ride = motionPath(marker, '#track', { autoRotate: true })

ride.spring(1)               // travel to the end with a real spring
ride.flick(2.4)              // fling it down the path; it decays to a stop
ride.spring(0.4)             // retarget mid-flight, momentum kept

ride.t                       // the live 0..1 Animatable - compose it (scroll, timeline)
ride.revert()                // unbind and restore the element's transform
```

## `draw()`

Draw a stroke on (0 = hidden, 1 = fully drawn). The fraction is a live `Animatable` too - it can overshoot, and you can interrupt it mid-draw.

```ts
import { draw } from '@underlying/svg'

const line = draw('#signature')
line.spring(1)               // draw it on
line.to(0, { duration: 400 })// erase with a timed tween, still interruptible
```

## `morph()`

Turn one shape into another. Both outlines are resampled into points along their length and interpolated, so *any* two paths morph - you do not have to match their commands by hand. The fraction is live, so you can scrub it or grab it mid-morph.

```ts
import { morph } from '@underlying/svg'

const m = morph(blob, starPathData, { closed: true })  // target: a `d` string or an element
m.spring(1)   // morph to the star
m.spring(0)   // morph back - interruptible
m.set(0.5)    // hold it halfway
```

This is a resampling morph (smooth, handles arbitrary shapes); full command-preserving MorphSVG - sharp-corner fidelity and `shapeIndex` - is future work.

## The familiar one-call form

Both accept a `{ to }` kickoff that reads like `gsap.to(el, { motionPath })` or `{ drawSVG }` - but springs under the hood, and the handle is still there for the live wins.

```ts
motionPath(marker, '#track', { to: 1, autoRotate: true })
draw('#signature', { to: 1 })
```

## Composing - drive the same path from scroll or a timeline

`motionPath` and `draw` own a driver `Animatable` (`.t` / `.fraction`) you can hand to anything that drives a value.

```ts
import { motionPath } from '@underlying/svg'
import { createScroll } from '@underlying/scroll'

const ride = motionPath(marker, '#track', { autoRotate: true })
createScroll({ scroller }).scrub(ride.t)   // marker follows the path as you scroll
```

## Bring your own driver

The handles are built on thin binders. If you already have an `Animatable` (or want to control the value yourself, GSAP-style), bind it directly:

```ts
import { bindPath, bindDraw, samplePath } from '@underlying/svg'
import { animatable } from '@underlying/core'

const t = animatable(0)
bindPath(marker, '#track', t, { autoRotate: true }) // maps t -> transform
t.decay({ velocity: 2.4 })

samplePath('#track').at(0.5)  // low-level: { x, y, angle } at progress 0.5
```

## Notes

- **Reduced motion** is inherited from core: a `spring`/`decay`/`to` on the driver auto-degrades under `prefers-reduced-motion`, so the element jumps to the target with no travel.
- **Coordinate space.** `motionPath` writes the sampled point straight to the element's `transform`, so the element and the path should share a coordinate space (e.g. both inside the same SVG, or the element absolutely positioned over it).
- **SSR.** Sampling needs the DOM; pass an element rather than a selector on the server, or call from an effect.
- **Morph** here resamples both outlines into points and interpolates - it handles any two shapes, but it is not yet the full command-preserving MorphSVG (sharp corners can soften; raise `samples` for fidelity).

## License

MIT (c) underlyi.ng
