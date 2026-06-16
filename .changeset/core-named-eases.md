---
"@underlying/core": minor
---

`easing` now accepts a GSAP-style name, not just a function. `ToOptions.easing` and `AnimateOptions.easing` take a function OR a string (`'power2.out'`, `'elastic.out(1, 0.3)'`), resolved at the tween and the WAAPI keyframe builder. A small registry (`registerEasing`) is the extension point - `@underlying/utils` fills it on import - and nothing is registered at module scope, so the primitives tree-shake graph stays untouched. An unknown name warns once and falls back to `easeInOutCubic`, never throws.
