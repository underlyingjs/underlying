---
"@underlying/core": minor
---

Extended value model: `animate()` now drives any CSS property (and custom properties), not just the five transform/opacity channels. Values decompose into scalar channels through a lazily-seeded value-type registry and reformat to CSS each frame.

- **Lengths & units** - `width: '50%'` from a computed px start converts with a single measurement, rebasing position **and** velocity; unconvertible/unparseable values snap with a one-time dev warning, never a throw.
- **Colors** - hex (`#rgb`/`#rrggbb`/`#rrggbbaa`), `rgb()/rgba()`, `hsl()`, and named colors, mixed in gamma-2.0 (approximate linear-light) space; non-spatial, so they keep crossfading under reduced-motion `fade`.
- **Composite values** - `box-shadow`, `filter`, etc. via a generic complex type with kind-stable token realignment (absorbs Chromium's color-first computed order) and `none`/unset zero-equivalent synthesis.
- **Keyframes** - `{ x: [0, 120, 80] }`: chained springs without a duration, an evenly-split piecewise tween with one (WAAPI multi-keyframe when eligible, with piecewise reclaim).
- **`setStyle` / `releaseStyle`** - coherent teleport with gesture-velocity handoff, and an explicit uncache hatch.
- **`registerValueType`** - the public extension point for custom property descriptors.

Numeric channels keep their exact fast path and compositor delegation. A transforms-only import tree-shakes the entire value model away (CI probe: ~2.3 kB gzip); the full surface is ~10.5 kB gzip.
