---
"@underlying/scroll": minor
"@underlying/core": minor
---

Initial beta of `@underlying/scroll`: scroll-driven animation on the physics core. Scroll is a source, not an engine - the package owns the three browser concerns the core refuses (IntersectionObserver, one passive scroll/resize listener, `getBoundingClientRect`), normalizes scroll to `0..1`, and fans it onto existing core seams. No physics is re-implemented.

- **`scrub()`** - drive a seekable handle from scroll. `smooth: false` locks the playhead frame-for-frame (reversible, deterministic); a number routes through `follow()` for a momentum trail with conserved velocity. A live spring is `bake()`d once at link time.
- **`parallax()`** - map a range's progress to px on a `bindStyle`-ready `Animatable`.
- **`pin()`** - spacer wrap + `position: fixed` across a range, gated on `raw()` crossings; exposes its own child `Track` for nested scrubs.
- **`snap()`** - opt-in momentum snap on scroll-idle, directional and spring-settled; acts only on release, never scroll-jacking.
- **`trigger()`** - enter/leave via one `IntersectionObserver`, crossing direction read from the entry geometry, the `toggleActions` verbs.
- **`track()`** - the raw `0..1` primitive every builder composes from.

The offset grammar is the `[element edge] [viewport edge]` offset model. Reduced motion is one centralized policy (momentum scrub collapses to locked, parallax disabled, momentum snap instant), re-routed live on preference change. Lazy and SSR-safe: nothing touches browser globals at import, and a manual scroll source mirrors the core's manual driver for deterministic tests. About 4 kB gzip with the core marked external.

`@underlying/core` gains a test-only `@underlying/core/testing` subpath (re-exports the manual frame driver) and exports `getSharedScheduler`, so scroll shares the one rAF loop.
