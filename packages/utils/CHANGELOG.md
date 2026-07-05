# @underlying/utils

## 1.2.0-beta.6

### Patch Changes

- @underlying/core@1.2.0-beta.6

## 1.2.0-beta.5

### Patch Changes

- Updated dependencies [fb77271]
  - @underlying/core@1.2.0-beta.5

## 1.2.0-beta.4

### Patch Changes

- @underlying/core@1.2.0-beta.4

## 1.2.0-beta.3

### Patch Changes

- Updated dependencies [7aafc87]
- Updated dependencies [5bebad9]
  - @underlying/core@1.2.0-beta.3

## 1.2.0-beta.2

### Minor Changes

- 43b8607: Custom-curve and procedural easing (#57), beyond the named families and `cubicBezier`:

  ```ts
  import { customEase, wiggle, shake, slow, rough } from "@underlying/utils";

  animate(el, { x: 0 }, { easing: customEase("M0,0 C0.4,0 0.2,1 1,1") }); // a design-tool curve, verbatim
  animate(el, { x: 0 }, { easing: shake(6) }); // arrives and rattles to rest
  animate(el, { opacity: 1 }, { easing: rough({ seed: 7, taper: "out" }) }); // a seeded glitch-in
  ```

  - **`customEase(source)`** builds an easing from an SVG-path string (`'M0,0 C0.4,0 0.2,1 1,1'`, multi-segment ok) or an array of `[x, y]` points, used verbatim. It normalizes each axis from the first/last anchor, so any artboard size or SVG y-down maps to 0..1. Parsed and sampled without the DOM.
  - **`wiggle(count, options?)`** and **`shake(count, options?)`** are a damped oscillator as an easing: the value overshoots, then wobbles with decaying amplitude and settles exactly on the target - the same struck-and-settle family as `elastic`, not a fixed-amplitude sine. Endpoint-exact for any count and wave (`sine` / `triangle` / `square`).
  - **`rough(options?)`** is seeded jitter - a glitchy stepped (or smoothed) deviation from a baseline. The seed fixes the curve, so it is reproducible and SSR-stable (no `Math.random` on the easing path); change the seed for a different glitch.
  - **`slow(linearRatio, power)`** lingers through a shallow middle and races at the ends.

  All four register for string resolution via `@underlying/utils/register` (`'wiggle(6)'`, `'shake(8)'`, `'slow(0.75, 0.85)'`, `'rough(24, 0.3, 7)'`); their non-numeric options are the function-form. Existing `cubicBezier` and the named families are unchanged.

### Patch Changes

- @underlying/core@1.2.0-beta.2

## 1.2.0-beta.1

### Patch Changes

- @underlying/core@1.2.0-beta.1

## 1.2.0-beta.0

### Patch Changes

- @underlying/core@1.2.0-beta.0

## 1.1.0

### Patch Changes

- Updated dependencies [7733826]
- Updated dependencies [786aca7]
- Updated dependencies [cf994f5]
- Updated dependencies [3f85820]
  - @underlying/core@1.1.0

## 1.1.0-beta.4

### Patch Changes

- Updated dependencies [7733826]
- Updated dependencies [786aca7]
- Updated dependencies [cf994f5]
- Updated dependencies [3f85820]
  - @underlying/core@1.1.0-beta.4

## 1.1.0-beta.3

### Patch Changes

- @underlying/core@1.1.0-beta.3

## 1.1.0-beta.2

### Patch Changes

- @underlying/core@1.1.0-beta.2

## 1.1.0-beta.1

### Patch Changes

- @underlying/core@1.1.0-beta.1

## 1.1.0-beta.0

### Patch Changes

- @underlying/core@1.1.0-beta.0

## 1.0.0

- First stable release. Named ease families and helpers (clamp, mapRange, interpolate, snap, wrap, random...), tree-shakeable, with a `/register` entry for string eases. Leaving beta: the API is frozen and the @underlying suite now versions together.

## 0.1.0-beta.2

### Patch Changes

- Updated dependencies [c4dd1e9]
  - @underlying/core@0.1.0-beta.6

## 0.1.0-beta.1

### Minor Changes

- a27ed4d: Initial beta of `@underlying/utils`: the named-ease and helpers layer for `@underlying/core`. The full named-ease library (`power1-4`, `sine`, `expo`, `circ`, `back`, `elastic`, `bounce`, `steps`) plus `cubicBezier` - each a plain function you can pass directly (`easing: power2.out`), or by string (`'power2.out'`, `'elastic.out(1, 0.3)'`) after `import '@underlying/utils/register'` so existing ease-name code ports across unchanged. Plus the helpers `clamp`, `mapRange`, `interpolate`, `snap`, `wrap`, `random`, `toArray`, `pipe`. Tree-shakeable, ~1.3 kB gzip. Springs already replace back/elastic/bounce for LIVE motion - this layer is for baked tweens, scrubbable timelines, and ports.

### Patch Changes

- Updated dependencies [a27ed4d]
  - @underlying/core@0.1.0-beta.5
