<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/wordmark-cream.svg" />
    <img alt="underlying" src="brand/wordmark-sapin.svg" width="300" />
  </picture>
</p>

<p align="center"><strong>Physics-first motion for the web.</strong></p>

<p align="center">
  Springs and inertia by default. Every value interruptible, with its velocity conserved.
  <br />Accessible out of the box. Zero dependencies. React, Vue and Angular adapters.
  <br />~12 kB gzip for animate(), tree-shakeable to ~3.5 kB.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@underlying/core"><img alt="@underlying/core on npm" src="https://img.shields.io/npm/v/@underlying/core?label=core&color=1C3426" /></a>
  <a href="https://www.npmjs.com/package/@underlying/scroll"><img alt="@underlying/scroll on npm" src="https://img.shields.io/npm/v/@underlying/scroll?label=scroll&color=1C3426" /></a>
  <a href="https://www.npmjs.com/package/@underlying/timeline"><img alt="@underlying/timeline on npm" src="https://img.shields.io/npm/v/@underlying/timeline?label=timeline&color=1C3426" /></a>
  <a href="https://www.npmjs.com/package/@underlying/gestures"><img alt="@underlying/gestures on npm" src="https://img.shields.io/npm/v/@underlying/gestures?label=gestures&color=1C3426" /></a>
  <a href="https://www.npmjs.com/package/@underlying/text"><img alt="@underlying/text on npm" src="https://img.shields.io/npm/v/@underlying/text?label=text&color=1C3426" /></a>
  <a href="https://www.npmjs.com/package/@underlying/flip"><img alt="@underlying/flip on npm" src="https://img.shields.io/npm/v/@underlying/flip?label=flip&color=1C3426" /></a>
  <a href="https://www.npmjs.com/package/@underlying/svg"><img alt="@underlying/svg on npm" src="https://img.shields.io/npm/v/@underlying/svg?label=svg&color=1C3426" /></a>
  <a href="https://www.npmjs.com/package/@underlying/utils"><img alt="@underlying/utils on npm" src="https://img.shields.io/npm/v/@underlying/utils?label=utils&color=1C3426" /></a>
  <br />
  <a href="https://www.npmjs.com/package/@underlying/react"><img alt="@underlying/react on npm" src="https://img.shields.io/npm/v/@underlying/react?label=react&color=1C3426" /></a>
  <a href="https://www.npmjs.com/package/@underlying/vue"><img alt="@underlying/vue on npm" src="https://img.shields.io/npm/v/@underlying/vue?label=vue&color=1C3426" /></a>
  <a href="https://www.npmjs.com/package/@underlying/angular"><img alt="@underlying/angular on npm" src="https://img.shields.io/npm/v/@underlying/angular?label=angular&color=1C3426" /></a>
  <a href="https://docs.underlyi.ng"><img alt="docs" src="https://img.shields.io/badge/docs-underlyi.ng-1C3426" /></a>
  <img alt="core gzip" src="https://img.shields.io/badge/core-~12%20kB%20gzip-1C3426" />
  <img alt="dependencies" src="https://img.shields.io/badge/deps-0-1C3426" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-1C3426" />
</p>

---

Most animation libraries make you describe motion as a duration and a curve. `underlying` starts from physics: you set a target, and a spring, a glide or a decay carries the value there - interruptible at any moment, with momentum preserved. Duration and easing still exist, as an escape hatch, not as the default.

```ts
import { animate } from '@underlying/core'

animate(box, { x: 320, rotate: 12 })   // springs by default
animate(box, { x: 0, rotate: 0 })      // retarget mid-flight: velocity conserved, never a jump
```

## Why physics-first

- **Physical by default.** No hardcoded durations, no cubic-bezier guesswork. Springs, inertia and decay drive the motion; `duration` / `easing` is the escape hatch.
- **Interruptible by design.** Every animated value knows its position *and its velocity*. A second call retargets from exactly where it is, carrying momentum - not a parallel animation, not a restart.
- **Accessible natively.** `prefers-reduced-motion` is respected with zero config (skip or fade), reacts to mid-session OS changes, and supports app-level overrides.
- **Deterministic.** A fixed 1/120 s timestep: the same inputs produce the same trajectory at 60, 120 or 144 Hz.
- **One rAF loop.** Everything batches into a single tick - simulations first, style writes after. Eligible tweens ride the WAAPI compositor and hand control back losslessly on interruption.
- **Any CSS property.** Beyond the five transform/opacity channels: lengths with unit conversion, colors, composite values and keyframe arrays, through a tree-shakeable value-type registry.

## Playback

Springs stay live; tweens are seekable. The opt-in [`@underlying/core/playback`](packages/core) entry adds pause, timeScale, reverse and seek - plus `bake()`, which samples a spring's trajectory into a scrubbable clip, `follow()` for momentum scrub, and `sequence()`, a live composition you interrupt by hand (the twin of the timeline you scrub).

```ts
import { playable, follow, sequence } from '@underlying/core/playback'

const motion = playable(value).spring(300)
motion.pause().timeScale(0.25)   // slow-mo, identical trajectory shape

const lag = follow(0)            // a value that springs toward a moving target
onScroll((y) => lag.target(y))   // momentum scrub, conserved velocity

sequence().spring(a, 1).spring(b, 1, { overlap: 80 }).play()   // live cascade, grab it mid-flight
```

## Packages

Live, interruptible physics is the default - for a single value (core, scroll's momentum scrub), for whole compositions (`sequence()`), for drag and fling (`@underlying/gestures`), and for FLIP layout transitions (`@underlying/flip`). The layers that let you scrub *time* - scroll's locked scrub, the timeline - record that physics into a seekable form: the motion stays physics-shaped (a real spring trajectory, overshoot and all), never an eased fake. So composition comes in two honest flavors: live and interruptible (`sequence()`), or recorded and scrubbable (the timeline).

| Package | Description | Status |
| --- | --- | --- |
| [`@underlying/core`](packages/core) | Scheduler, animatable values, springs / inertia / decay, any-CSS-property value model, composition, a11y, WAAPI delegation | stable |
| `@underlying/core/playback` | pause / timeScale / reverse / seek, `bake()`, `follow()`, `sequence()` - opt-in, separate bundle | stable |
| [`@underlying/scroll`](packages/scroll) | Scrub, parallax, pin, snap, triggers - scroll as a source driving animatables | stable |
| [`@underlying/timeline`](packages/timeline) | Seekable timelines: labels, relative positions, nesting, stagger - scrubbable, physics-shaped | stable |
| [`@underlying/gestures`](packages/gestures) | Drag, fling and interruptible FLIP - pointer velocity into physics, layout transitions that retarget mid-flight | stable |
| [`@underlying/flip`](packages/flip) | FLIP layout and shared-element transitions, drag-to-reorder, presence lists - interruptible, retargeting from live velocity | stable |
| [`@underlying/text`](packages/text) | Accessible split (chars / words / lines), physics reveal, scramble, typewriter | stable |
| [`@underlying/svg`](packages/svg) | SVG path animation: ride a path (`motionPath`), draw a stroke on (`draw`), morph one shape into another (`morph`) - physics-first, flick / interrupt / scrub | stable |
| [`@underlying/utils`](packages/utils) | Named eases (`power`, `back`, `elastic`, `bounce`, `steps`, `cubicBezier`) by function or string, plus `clamp` / `mapRange` / `interpolate` / `snap` / `wrap` / `random` | stable |
| [`@underlying/react`](packages/react) | Hooks binding `animate()`, gestures, text and FLIP to a ref, with teardown on unmount | stable |
| [`@underlying/vue`](packages/vue) | Composables binding the same to a template ref, with teardown on unmount | stable |
| [`@underlying/angular`](packages/angular) | Standalone directives binding the same to your elements, with teardown on destroy | stable |

## Framework adapters

The same primitives, bound to your framework's lifecycle - created on mount, torn down automatically. Each adapter pulls in the underlying packages it needs (core, gestures, text, flip), so installing the adapter is enough. Their version ranges are caret-pinned, so if you also import `@underlying/core` directly it dedupes to a single shared core (one rAF loop).

```tsx
// React
import { useAnimate, useDraggable } from '@underlying/react'
const box = useAnimate<HTMLDivElement>({ x: open ? 200 : 0 })   // retargets, velocity conserved
return <div ref={box} />
```

```vue
<!-- Vue -->
<script setup lang="ts">
import { useAnimate } from '@underlying/vue'
const box = useAnimate<HTMLDivElement>(() => ({ x: open.value ? 200 : 0 }))
</script>
<template><div :ref="box" /></template>
```

```html
<!-- Angular (standalone directives) -->
<div uAnimate [uAnimate]="{ x: open() ? 200 : 0 }"></div>
```

Angular directives run outside the zone and no-op during SSR; the React and Vue adapters are SSR-safe.

## Install

```sh
npm install @underlying/core                 # the library
npm install @underlying/scroll @underlying/gestures @underlying/text   # add-ons, as needed

npm install @underlying/react     # React  - pulls in the core packages it uses
npm install @underlying/vue       # Vue
npm install @underlying/angular   # Angular
```

Add `@underlying/core` alongside an adapter if you want to call `animate()` directly too; the caret ranges keep it a single instance.

Every demo on the docs site is live - [read the docs at docs.underlyi.ng](https://docs.underlyi.ng).

## Development

```sh
pnpm install
pnpm test        # Vitest
pnpm typecheck   # strict TypeScript
pnpm build       # ESM + CJS + types
pnpm size        # gzip budget gate
pnpm docs        # interactive docs site
```

## License

MIT © underlyi.ng
