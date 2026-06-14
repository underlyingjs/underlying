interface SegmenterLike {
  segment(input: string): Iterable<{ segment: string }>
}
interface SegmenterCtor {
  new (locales?: string, options?: { granularity?: 'grapheme' | 'word' | 'sentence' }): SegmenterLike
}

/**
 * Split into grapheme clusters. Emoji, flags, ZWJ sequences (family/profession)
 * and combining marks / skin tones stay ONE piece - unlike [...string], which
 * fixes surrogate pairs but still shatters those into broken fragments.
 * Falls back to code-point iteration where Intl.Segmenter is unavailable.
 */
export function graphemes(text: string, locale?: string): string[] {
  const Segmenter = (Intl as { Segmenter?: SegmenterCtor }).Segmenter
  if (Segmenter !== undefined) {
    return Array.from(new Segmenter(locale, { granularity: 'grapheme' }).segment(text), (entry) => entry.segment)
  }
  return [...text]
}
