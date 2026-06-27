# @underlying/text

## 1.2.0-beta.2

### Patch Changes

- @underlying/core@1.2.0-beta.2

## 1.2.0-beta.1

### Patch Changes

- @underlying/core@1.2.0-beta.1

## 1.2.0-beta.0

### Minor Changes

- d99e408: Masked reveal + responsive re-split (#53). `reveal()` gains a `mask` option that wraps each piece (line, word, or char) in a clip mask, so it rises from behind a hard edge - the headline reveal - on the same live spring (overshoot and all):

  ```ts
  reveal(headline, { by: "lines", mask: true });
  ```

  A masked line reveal also re-splits, re-masks, and re-settles on reflow / font load by default (the new `resize` option, default = `mask`), so the line masks follow the text after a width change; if the entrance already finished, the new lines appear settled, not hidden again. `bleed` adds a little bottom clip room for descenders under a tight line-height.

  `split()` gains an `onResplit` callback, fired after each in-place rebuild (never on the initial split), so any per-piece state can be re-applied after a reflow.

  Accessibility is unchanged: the screen reader still reads the text whole (the visually-hidden copy), the animated pieces and mask wrappers are aria-hidden, and under reduced motion the text shows immediately with no clip and no motion. Plain `reveal()` / `split()` calls are byte-identical.

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

- First stable release. Accessible `split()` plus `reveal()`, `scramble()` and `typewriter()` - the screen reader reads the text whole. Leaving beta: the API is frozen and the @underlying suite now versions together.

## 0.1.0-beta.5

### Patch Changes

- Updated dependencies [c4dd1e9]
  - @underlying/core@0.1.0-beta.6

## 0.1.0-beta.4

### Patch Changes

- Updated dependencies [a27ed4d]
  - @underlying/core@0.1.0-beta.5

## 0.1.0-beta.3

### Patch Changes

- Updated dependencies [bf6b019]
  - @underlying/core@0.1.0-beta.4

## 0.1.0-beta.2

### Patch Changes

- Updated dependencies [ec2d1de]
  - @underlying/core@0.1.0-beta.3

## 0.1.0-beta.1

### Minor Changes

- 21eb78c: Initial beta of `@underlying/text`: accessible text splitting and physics-first reveal, on `@underlying/core`.

  - `split(element, options)` splits text into chars / words / lines WITHOUT breaking accessibility - a visually-hidden real-text copy stays the only thing a screen reader and copy/paste see, the animated pieces are `aria-hidden`, emoji / flags / ZWJ sequences stay whole (`Intl.Segmenter`), and lines are measured from layout (`offsetTop` after fonts load) and re-split on resize. `revert()` restores the element byte-identical.
  - `reveal(element, options)` splits then springs the pieces in - a real spring, not an eased curve - and is reduced-motion safe (shows immediately, no per-piece motion).
  - `scramble(element, text, options)` decodes text in and `typewriter(element, text, options)` types it in, both on the frame clock (background-tab-safe), with the final text as the accessible name throughout (the changing characters are `aria-hidden`, never read as gibberish).

  ~2 kB gzip on top of core. Built on core's stagger / animate / reduced-motion seams - no new engine.
