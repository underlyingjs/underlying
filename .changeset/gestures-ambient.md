---
"@underlying/gestures": minor
---

`ambient()` - perpetual idle/ambient self-animation, so nothing on the page ever sits perfectly still (#58). One call makes an element subtly alive on live springs (never a baked keyframe loop):

```ts
ambient(logo)                                  // breathe + drift on by default
ambient(hero, { breathe: { scale: 0.06 } })    // a slow breathing accent
```

Four composable behaviors, each a perpetual physics simulation summed into one transform: `breathe` (a breathing sine on scale, optionally opacity), `drift` (a phase-offset orbital x/y Lissajous), `bob` (a gentle vertical float), and `wander` - the headline: pass an array and the group shares one field of slowly-roaming attractor points, so the elements wander as a living constellation when the pointer is idle and **bend into pointer-parallax with velocity conserved** when it moves, drifting back off after a moment of stillness:

```ts
const field = ambient(dots, { wander: { radius: 50, parallax: 30 } })
```

A per-element seed phase-offsets every behavior so a group never moves in lockstep, the whole field shares one pointer listener and one clock, and it is held completely still under `prefers-reduced-motion` (two-way) - self-motion still runs on touch, only the pointer-parallax half is fine-pointer-only. The composed `x` / `y` / `scale` / `opacity` are live values you can read and compose, like `depth()`.
