---
"@underlying/text": minor
---

Masked reveal + responsive re-split (#53). `reveal()` gains a `mask` option that wraps each piece (line, word, or char) in a clip mask, so it rises from behind a hard edge - the headline reveal - on the same live spring (overshoot and all):

```ts
reveal(headline, { by: 'lines', mask: true })
```

A masked line reveal also re-splits, re-masks, and re-settles on reflow / font load by default (the new `resize` option, default = `mask`), so the line masks follow the text after a width change; if the entrance already finished, the new lines appear settled, not hidden again. `bleed` adds a little bottom clip room for descenders under a tight line-height.

`split()` gains an `onResplit` callback, fired after each in-place rebuild (never on the initial split), so any per-piece state can be re-applied after a reflow.

Accessibility is unchanged: the screen reader still reads the text whole (the visually-hidden copy), the animated pieces and mask wrappers are aria-hidden, and under reduced motion the text shows immediately with no clip and no motion. Plain `reveal()` / `split()` calls are byte-identical.
