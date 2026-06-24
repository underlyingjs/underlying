---
"@underlying/core": minor
---

Authoring ergonomics for real apps (#52): expressive stagger, multi-target `animate()`, relative and per-target function values, and a responsive teardown layer.

- **`staggerDelay(options)`** builds a delay schedule `(index, total) => ms` you pass to `stagger()` or to `animate()`'s new `delay` option. Choose the wave origin (`start` / `end` / `center` / `edges` / `random` / a specific index), propagate across a 2D grid by cell distance (`grid: { cols }`), restrict to an axis, and redistribute the spacing through an easing. `random` is deterministic from a `seed`. The plain `stagger(items, fn, delayMs)` and the linear default are unchanged.
- **Multi-target `animate()`** now accepts an element, an array, a `NodeList`, or a CSS selector string and returns ONE handle for the whole set. Single-element calls keep their exact original fast path (and the WAAPI compositor path).
- **Relative and function values**: a target can be `'+=100'` / `'-=40'` / `'*=2'` resolved against the live value (so a re-fire retargets from the in-flight position, physics-first), or a per-target function `(index, element, count) => value`. Relatives compose on numeric channels and single-magnitude length/number properties (unit preserved).
- **`responsive(query | { reducedMotion }, setup)`** runs a setup when a media query starts matching and its returned teardown when it stops - the reduced-motion form reuses the app-level override. SSR-safe and client-only.
- **`region(setup?)`** is a teardown boundary: scope-bound `animate` / `stagger` / `responsive` / `setStyle` plus `add` / `track`, and a single `revert()` that stops the animations, removes the media listeners, and releases the inline styles - the mount/unmount seam for framework adapters.

Also exported: `resolveTargets`, `staggerDelays`, and the `DelayFn` / `StaggerOrigin` / `StaggerGrid` / `StaggerAxis` / `StaggerDelayOptions` / `AnimationTarget` / `RelativeValue` / `ValueFn` / `ResponsiveSetup` / `Region` types.
