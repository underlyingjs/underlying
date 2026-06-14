import { reveal, scramble, split, typewriter, type Reveal, type SplitType, type TextEffect } from '@underlying/text'
import { button, dropdown, h, type Section } from '../showcase'

export const textSplit: Section = {
  id: 'text-split',
  group: 'Text',
  title: 'split()',
  tagline: 'Chars, words or lines - and a screen reader still reads it whole.',
  description: `
    <p>The accessible foundation. Each piece is outlined here so you can see the
    split - switch the granularity. A visually-hidden real-text copy stays the only
    thing a screen reader and copy/paste see, so <strong>select this line and copy
    it</strong>: you get clean text, not glued-together words or per-letter garbage.
    The emoji stays whole, too.</p>`,
  code: `import { split } from '@underlying/text'

const s = split(headline, { type: ['words'] })  // s.chars / s.words / s.lines
s.revert()                                        // restore, byte-identical`,
  run(ctx) {
    const para = h('p', { class: 'textdemo__split' }, 'Split me by word, character or line. ✨')
    ctx.stage.append(para)
    let current = split(para, { type: ['words'] })
    ctx.onCleanup(() => {
      current.revert()
      para.remove()
    })
    ctx.controls.append(
      dropdown(
        'split by',
        [
          { value: 'words', label: 'words' },
          { value: 'chars', label: 'characters' },
          { value: 'lines', label: 'lines' },
        ],
        (value) => {
          current.revert()
          current = split(para, { type: [value as SplitType] })
        },
      ),
    )
  },
}

export const textReveal: Section = {
  id: 'text-reveal',
  group: 'Text',
  title: 'reveal()',
  tagline: 'Split a headline and spring it in - one call, reduced-motion safe.',
  description: `
    <p>One call: split, then spring the pieces in - a real spring, overshoot and all,
    not an eased curve. Press <strong>reveal</strong>. The screen reader still reads
    the headline whole (it is just a staggered <code>animate()</code> over the split
    words), and under <code>prefers-reduced-motion</code> it shows immediately with no
    per-piece motion.</p>`,
  code: `import { reveal } from '@underlying/text'

reveal(headline, { by: 'words', each: 55, from: { y: 26, opacity: 0 } })`,
  run(ctx) {
    const headline = h('h2', { class: 'textdemo__headline' }, 'Physics, not curves. ✨')
    ctx.stage.append(headline)
    let played: Reveal | null = null
    ctx.onCleanup(() => {
      played?.revert()
      headline.remove()
    })
    ctx.controls.append(
      button('reveal', () => {
        played?.revert()
        played = reveal(headline, { by: 'words', each: 60, from: { y: 26, opacity: 0 } })
      }),
    )
  },
}

export const textScramble: Section = {
  id: 'text-scramble',
  group: 'Text',
  title: 'scramble()',
  tagline: 'Decode it in - the screen reader gets the result, never the gibberish.',
  description: `
    <p>Positions reveal left to right while the rest cycle random glyphs, settling on
    the target - on the frame clock, so a background tab pauses it. Throughout, the
    element's accessible name is the <em>final</em> word and the scrambling is
    <code>aria-hidden</code>, so a screen reader announces it once, not a stream of
    noise. Press <strong>scramble</strong>.</p>`,
  code: `import { scramble } from '@underlying/text'

scramble(title, 'underlying')`,
  run(ctx) {
    const word = h('div', { class: 'textdemo__big' }, 'underlying')
    ctx.stage.append(word)
    let fx: TextEffect | null = null
    ctx.onCleanup(() => {
      fx?.stop()
      word.remove()
    })
    ctx.controls.append(
      button('scramble', () => {
        fx?.stop()
        fx = scramble(word, 'underlying', { duration: 1300 })
      }),
    )
  },
}

export const textTypewriter: Section = {
  id: 'text-typewriter',
  group: 'Text',
  title: 'typewriter()',
  tagline: 'Type it in, grapheme by grapheme, the full text as the accessible name.',
  description: `
    <p>Types the text in one grapheme at a time (emoji stay whole). Same a11y as
    scramble: the full text is the accessible name throughout, the partial text is
    <code>aria-hidden</code>, so it is read once rather than letter by letter. Press
    <strong>type</strong>.</p>`,
  code: `import { typewriter } from '@underlying/text'

typewriter(line, 'physics-first.')`,
  run(ctx) {
    const line = h('div', { class: 'textdemo__line' }, 'physics-first.')
    ctx.stage.append(line)
    let fx: TextEffect | null = null
    ctx.onCleanup(() => {
      fx?.stop()
      line.remove()
    })
    ctx.controls.append(
      button('type', () => {
        fx?.stop()
        fx = typewriter(line, 'physics-first.')
      }),
    )
  },
}
