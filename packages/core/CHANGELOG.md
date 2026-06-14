# @underlying/core

## 0.1.0-beta.1

### Minor Changes

- 68b1a7a: Initial beta of `@underlying/scroll`: scroll-driven animation on the physics core. Scroll is a source, not an engine - the package owns the three browser concerns the core refuses (IntersectionObserver, one passive scroll/resize listener, `getBoundingClientRect`), normalizes scroll to `0..1`, and fans it onto existing core seams. No physics is re-implemented.

  - **`scrub()`** - drive a seekable handle from scroll. `smooth: false` locks the playhead frame-for-frame (reversible, deterministic); a number routes through `follow()` for a momentum trail with conserved velocity. A live spring is `bake()`d once at link time.
  - **`parallax()`** - map a range's progress to px on a `bindStyle`-ready `Animatable`.
  - **`pin()`** - spacer wrap + `position: fixed` across a range, gated on `raw()` crossings; exposes its own child `Track` for nested scrubs.
  - **`snap()`** - opt-in momentum snap on scroll-idle, directional and spring-settled; acts only on release, never scroll-jacking.
  - **`trigger()`** - enter/leave via one `IntersectionObserver`, crossing direction read from the entry geometry, ScrollTrigger-style `toggleActions`.
  - **`track()`** - the raw `0..1` primitive every builder composes from.

  The offset grammar is the Motion/ScrollTrigger `[edge] [edge]` model. Reduced motion is one centralized policy (momentum scrub collapses to locked, parallax disabled, momentum snap instant), re-routed live on preference change. Lazy and SSR-safe: nothing touches browser globals at import, and a manual scroll source mirrors the core's manual driver for deterministic tests. About 4 kB gzip with the core marked external.

  `@underlying/core` gains a test-only `@underlying/core/testing` subpath (re-exports the manual frame driver) and exports `getSharedScheduler`, so scroll shares the one rAF loop.

- cbdb2ec: Extended value model: `animate()` now drives any CSS property (and custom properties), not just the five transform/opacity channels. Values decompose into scalar channels through a lazily-seeded value-type registry and reformat to CSS each frame.

  - **Lengths & units** - `width: '50%'` from a computed px start converts with a single measurement, rebasing position **and** velocity; unconvertible/unparseable values snap with a one-time dev warning, never a throw.
  - **Colors** - hex (`#rgb`/`#rrggbb`/`#rrggbbaa`), `rgb()/rgba()`, `hsl()`, and named colors, mixed in gamma-2.0 (approximate linear-light) space; non-spatial, so they keep crossfading under reduced-motion `fade`.
  - **Composite values** - `box-shadow`, `filter`, etc. via a generic complex type with kind-stable token realignment (absorbs Chromium's color-first computed order) and `none`/unset zero-equivalent synthesis.
  - **Keyframes** - `{ x: [0, 120, 80] }`: chained springs without a duration, an evenly-split piecewise tween with one (WAAPI multi-keyframe when eligible, with piecewise reclaim).
  - **`setStyle` / `releaseStyle`** - coherent teleport with gesture-velocity handoff, and an explicit uncache hatch.
  - **`registerValueType`** - the public extension point for custom property descriptors.

  Numeric channels keep their exact fast path and compositor delegation. A transforms-only import tree-shakes the entire value model away (CI probe: ~2.3 kB gzip); the full surface is ~10.5 kB gzip.

## 0.1.0-beta.0

### Minor Changes

- Initial beta release. Physics-first animatable values: interruptible springs with velocity conservation on retarget, bounded inertial decay (rubber-band edges), duration/easing escape hatch sampled on the same fixed-timestep clock. Single-rAF scheduler with update/render phases, direct-to-style DOM bindings, stagger and sequence composition, prefers-reduced-motion support active by default (skip/fade strategies, app-level override), opportunistic WAAPI delegation for eligible tweens with lossless control handback.
