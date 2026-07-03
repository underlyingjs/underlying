---
"@underlying/core": minor
---

Keyframe expressivity + `filter()` / attribute / `autoAlpha` channels (#56).

```ts
import { animate, filter } from '@underlying/core'

// per-segment position + easing, and a null HOLD
animate(el, {
  x: [0, { value: 120, at: 0.25, ease: 'power2.out' }, 60],
  opacity: [0, 1, null, 0], // rise, hold, fall
}, { duration: 800 })

animate(hero, { filter: filter({ blur: 8, brightness: 1.1 }) }) // typed filter builder
animate(circle, { 'attr:r': [10, 40], 'attr:fill': '#ff0055' })  // SVG attributes
animate(dialog, { autoAlpha: 0 })                                // opacity + visibility:hidden at 0
```

**Expressive keyframes.** A keyframe entry can be a `{ value, at, ease }` stop, not
just a bare value: `at` places the waypoint at a 0..1 fraction of the duration,
`ease` sets that one segment's easing, and a `null` mid-array holds the previous
value (a dwell). Bare values and stops mix freely, per key. These are tween-mode
features (they need a `duration`) and run on the JS path.

**`filter()` builder.** A typed spec (`blur`, `brightness`, `hueRotate`,
`dropShadow`, ...) rendered to a canonical-order CSS `filter` string, so two
results always interpolate. Filters already animated through the generic value
engine; this is the discoverable, typed surface.

**Attribute routing.** An `attr:` key animates an element or SVG attribute via
`setAttribute` (start read via `getAttribute`), reusing the whole value engine -
springs, keyframes, relatives (`'+='`), functions, and expressive stops. `animate()`
now accepts **SVG elements**, unlocking `viewBox` / `r` / `points` / `fill`.

**`autoAlpha`.** Animates opacity and toggles `visibility: hidden` at 0, so a fully
transparent element stops capturing pointer events.
