<p align="center">
  <img alt="underlying" src="https://underlyi.ng/wordmark-sapin.svg" width="280" />
</p>

<p align="center">
  <strong>Accessible text splitting and physics-first reveal.</strong>
</p>

<p align="center">
  <a href="https://underlyi.ng"><img alt="docs" src="https://img.shields.io/badge/docs-underlyi.ng-1C3426" /></a>
  <img alt="text gzip" src="https://img.shields.io/badge/text-2.08%20kB%20gzip-1C3426" />
  <img alt="built on" src="https://img.shields.io/badge/built%20on-%40underlying%2Fcore-1C3426" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-1C3426" />
</p>

> Beta. The API may still move before 1.0.

Split text into chars, words and lines you can animate - without breaking the things naive text-splitting historically breaks. The screen reader still reads the whole text, copy/paste is intact, and emoji stay whole.

```sh
npm install @underlying/text @underlying/core
```

## `split()`

The accessible foundation. A visually-hidden real-text copy stays the only thing screen readers and copy/paste see; the animated pieces are `aria-hidden`.

```ts
import { split } from '@underlying/text'
import { stagger, animate } from '@underlying/core'

const s = split(headline, { type: ['words', 'lines'] })
stagger(s.words, (el) => animate(el, { y: [20, 0], opacity: [0, 1] }), 30)
// s.revert() restores the element, byte-identical
```

- **Accessible by construction** - a screen reader reads "Hello world", not "H-e-l-l-o", and never twice.
- **Emoji-safe** - chars use `Intl.Segmenter`, so flags, ZWJ families and skin-tone sequences stay one piece.
- **Real lines** - measured from layout (`offsetTop` after `document.fonts.ready`) and re-split on width resize.
- **Lossless `revert()`** and SSR-safe.

### Options

- `type` (`('chars' | 'words' | 'lines')[]`, default `['words']`) - what to expose. Words are always built as the structural unit; `'chars'` and `'lines'` opt in. The returned `chars` and `lines` arrays stay empty unless requested.
- `a11y` (`'copy' | 'label' | 'off'`, default `'copy'`) - how the original text stays readable. This is the headline promise:
  - `'copy'` puts a visually-hidden real-text copy in the DOM (preserving nested markup) as the only thing screen readers and copy/paste see, and marks the animated pieces `aria-hidden`.
  - `'label'` sets `aria-label` on the element instead (no hidden copy, so copy/paste sees the pieces).
  - `'off'` does no accessibility handling - you own it.
- `resize` (`boolean`, default `true` when `'lines'` is requested, else `false`) - re-split lines on a width change. Line membership is a layout fact, so a reflow invalidates it; the observer is width-only and debounced.
- `locale` (`string`) - locale passed to `Intl.Segmenter` for grapheme segmentation.

## `reveal()`

One call: split, then spring the pieces in - a real spring, overshoot and all, not an eased curve. Reduced-motion safe (it shows immediately, no per-piece motion, under `prefers-reduced-motion`).

```ts
import { reveal } from '@underlying/text'

reveal(headline, { by: 'words', each: 40, from: { y: 24, opacity: 0 } })
```

### Options

- `by` (`'chars' | 'words' | 'lines'`, default `'words'`) - the granularity to stagger in.
- `each` (`number`, default `40`) - ms between pieces.
- `from` (`{ x?, y?, scale?, opacity? }`, default `{ y: 24, opacity: 0 }`) - the offset/hidden start state each piece springs from back to rest.
- `duration` (`number`) - per-piece tween duration in ms. Omit it (the default) to spring instead - a real spring, overshoot and all.
- `stiffness`, `damping` (`number`) - spring tuning, passed through to `animate()` for each piece.
- `scheduler` (`Scheduler`) - run the reveal on a custom frame clock; the start state is also set on it, so there is no flash.
- `a11y`, `locale` - forwarded to `split()` (see above).

`reveal()` returns `{ split, finished, stop(), revert() }`: `finished` resolves when every piece settles (or on `stop()`), and `revert()` stops, releases the per-piece state, and restores the original DOM. Under `prefers-reduced-motion` the text is shown at rest with no per-piece motion.

## `scramble()` and `typewriter()`

Content effects on the frame clock (a background tab pauses them). The final text is the accessible name throughout - the changing characters are `aria-hidden`, never read as gibberish.

```ts
import { scramble, typewriter } from '@underlying/text'

scramble(title, 'underlying')      // decode it in
typewriter(line, 'physics-first.') // type it in
```

Both return `{ finished, stop() }`. `finished` resolves when the effect completes (or on `stop()`), and `stop()` snaps to the final text now. Under `prefers-reduced-motion` each lands on the final text immediately.

### `scramble()` options

- `duration` (`number`, default `1400`) - total time in ms. Positions reveal left to right over this window.
- `chars` (`string`) - the pool of glyphs cycled through for not-yet-decoded positions. Defaults to a built-in symbol/hex pool; whitespace in the target is never scrambled.
- `locale` (`string`) - locale for grapheme segmentation of the target text.
- `scheduler` (`Scheduler`) - frame clock to run on. Defaults to the shared scheduler (so a background tab pauses it).

### `typewriter()` options

- `duration` (`number`) - total time in ms. Defaults to scaling with length, `max(400, length * 55)`, so short strings still take a readable beat and long ones do not crawl. The text is typed one grapheme at a time, so emoji stay whole.
- `locale` (`string`) - locale for grapheme segmentation.
- `scheduler` (`Scheduler`) - frame clock to run on (default shared).

## `graphemes()`

A low-level helper the splitter and effects use internally, also exported for when you need the same grapheme-correct segmentation yourself.

```ts
import { graphemes } from '@underlying/text'

graphemes('é')   // ['é'] - 'e' plus a combining acute is ONE cluster, not two
graphemes(text, 'th')  // pass a locale for Intl.Segmenter
```

It splits a string into grapheme clusters via `Intl.Segmenter`, so flags, ZWJ sequences (family/profession), combining marks and skin tones stay one piece - unlike `[...string]`, which fixes surrogate pairs but still shatters those. Where `Intl.Segmenter` is unavailable it falls back to code-point iteration.

## License

MIT (c) underlyi.ng
