---
"@underlying/core": minor
---

Live value templating (#68): compose several independent live values into one reactive CSS string, written to any property each frame.

`template` is a tagged template whose interpolations are live sources - an `animatable`, a `follow()`, a scroll/pointer spring - and whose literals carry the units, so it reads byte-for-byte like the CSS it emits:

```ts
const blur = follow(0), glow = follow(1)
bindTemplate(hero, 'filter', template`blur(${blur}px) brightness(${glow})`)
bindTemplate(sheen, '--sheen', template`${angle}deg`)
```

`bindTemplate(element, property, template, options?)` writes the composed string to any CSS property (including a `--custom` one) through the same change-gated render phase as `animate()`: one write per frame when several sources change together, byte-deduplicated so a value jittering below its precision writes nothing, and quiet at rest. It returns a `() => void` disposer that tears down every source subscription (and drops straight into `region.add(...)`); it is a read-only projection and never disposes its sources. There is also a function escape hatch for computed projections: `bindTemplate(el, 'transform', [x, y], (px, py) => \`translate3d(${px}px, ${py}px, 0)\`)`, arity-typed to the sources.

Numeric slots round to 4 decimals by default (matching the value model), configurable via `precision`. SSR-safe: `template` is pure in-memory assembly and the module touches no browser global at import.
