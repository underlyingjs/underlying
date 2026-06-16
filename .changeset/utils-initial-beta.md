---
"@underlying/utils": minor
---

Initial beta of `@underlying/utils`: the GSAP-parity layer for `@underlying/core`. The full named-ease library (`power1-4`, `sine`, `expo`, `circ`, `back`, `elastic`, `bounce`, `steps`) plus `cubicBezier` - each a plain function you can pass directly (`easing: power2.out`), or by string (`'power2.out'`, `'elastic.out(1, 0.3)'`) after `import '@underlying/utils/register'` so GSAP code ports across unchanged. Plus the helpers `clamp`, `mapRange`, `interpolate`, `snap`, `wrap`, `random`, `toArray`, `pipe`. Tree-shakeable, ~1.3 kB gzip. Springs already replace back/elastic/bounce for LIVE motion - this layer is for baked tweens, scrubbable timelines, and ports.
