---
"@underlying/text": minor
---

Initial beta of `@underlying/text`: accessible text splitting and physics-first reveal, on `@underlying/core`.

- `split(element, options)` splits text into chars / words / lines WITHOUT breaking accessibility - a visually-hidden real-text copy stays the only thing a screen reader and copy/paste see, the animated pieces are `aria-hidden`, emoji / flags / ZWJ sequences stay whole (`Intl.Segmenter`), and lines are measured from layout (`offsetTop` after fonts load) and re-split on resize. `revert()` restores the element byte-identical.
- `reveal(element, options)` splits then springs the pieces in - a real spring, not an eased curve - and is reduced-motion safe (shows immediately, no per-piece motion).
- `scramble(element, text, options)` decodes text in and `typewriter(element, text, options)` types it in, both on the frame clock (background-tab-safe), with the final text as the accessible name throughout (the changing characters are `aria-hidden`, never read as gibberish).

~2 kB gzip on top of core. Built on core's stagger / animate / reduced-motion seams - no new engine.
