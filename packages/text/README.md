<p align="center">
  <img alt="underlying" src="https://underlyi.ng/wordmark-sapin.svg" width="280" />
</p>

<p align="center">
  <strong>Accessible text splitting and physics-first reveal.</strong>
</p>

<p align="center">
  <a href="https://underlyi.ng"><img alt="docs" src="https://img.shields.io/badge/docs-underlyi.ng-1C3426" /></a>
  <img alt="text gzip" src="https://img.shields.io/badge/text-~2%20kB%20gzip-1C3426" />
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

## `reveal()`

One call: split, then spring the pieces in - a real spring, overshoot and all, not an eased curve. Reduced-motion safe (it shows immediately, no per-piece motion, under `prefers-reduced-motion`).

```ts
import { reveal } from '@underlying/text'

reveal(headline, { by: 'words', each: 40, from: { y: 24, opacity: 0 } })
```

## `scramble()` and `typewriter()`

Content effects on the frame clock (a background tab pauses them). The final text is the accessible name throughout - the changing characters are `aria-hidden`, never read as gibberish.

```ts
import { scramble, typewriter } from '@underlying/text'

scramble(title, 'underlying')      // decode it in
typewriter(line, 'physics-first.') // type it in
```

## License

MIT (c) underlyi.ng
