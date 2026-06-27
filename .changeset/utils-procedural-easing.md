---
"@underlying/utils": minor
---

Custom-curve and procedural easing (#57), beyond the named families and `cubicBezier`:

```ts
import { customEase, wiggle, shake, slow, rough } from '@underlying/utils'

animate(el, { x: 0 }, { easing: customEase('M0,0 C0.4,0 0.2,1 1,1') }) // a design-tool curve, verbatim
animate(el, { x: 0 }, { easing: shake(6) })                            // arrives and rattles to rest
animate(el, { opacity: 1 }, { easing: rough({ seed: 7, taper: 'out' }) }) // a seeded glitch-in
```

- **`customEase(source)`** builds an easing from an SVG-path string (`'M0,0 C0.4,0 0.2,1 1,1'`, multi-segment ok) or an array of `[x, y]` points, used verbatim. It normalizes each axis from the first/last anchor, so any artboard size or SVG y-down maps to 0..1. Parsed and sampled without the DOM.
- **`wiggle(count, options?)`** and **`shake(count, options?)`** are a damped oscillator as an easing: the value overshoots, then wobbles with decaying amplitude and settles exactly on the target - the same struck-and-settle family as `elastic`, not a fixed-amplitude sine. Endpoint-exact for any count and wave (`sine` / `triangle` / `square`).
- **`rough(options?)`** is seeded jitter - a glitchy stepped (or smoothed) deviation from a baseline. The seed fixes the curve, so it is reproducible and SSR-stable (no `Math.random` on the easing path); change the seed for a different glitch.
- **`slow(linearRatio, power)`** lingers through a shallow middle and races at the ends.

All four register for string resolution via `@underlying/utils/register` (`'wiggle(6)'`, `'shake(8)'`, `'slow(0.75, 0.85)'`, `'rough(24, 0.3, 7)'`); their non-numeric options are the function-form. Existing `cubicBezier` and the named families are unchanged.
