import { graphemes } from './segment'

export type SplitType = 'chars' | 'words' | 'lines'
export type SplitA11y = 'copy' | 'label' | 'off'

export interface SplitOptions {
  /** What to expose. Words are always built (as the structural unit); 'chars' and 'lines' opt in. Default ['words']. */
  type?: SplitType[]
  /**
   * How the original text stays readable. 'copy' (default): a visually-hidden real-text copy is the only
   * thing screen readers + copy/paste see, and the animated pieces are aria-hidden. 'label': aria-label on
   * the element. 'off': no accessibility handling (you own it).
   */
  a11y?: SplitA11y
  /** Locale for grapheme segmentation. */
  locale?: string
  /** Re-split lines on a width change (lines invalidate on reflow). Default true when 'lines' is requested. */
  resize?: boolean
}

export interface Split {
  /** Per-grapheme spans (empty unless 'chars' requested). */
  readonly chars: HTMLElement[]
  /** Per-word spans. */
  readonly words: HTMLElement[]
  /** Per-line spans (empty unless 'lines' requested). Re-measured on font load and width resize. */
  readonly lines: HTMLElement[]
  /** Restore the element to its exact pre-split state and stop observing. */
  revert(): void
}

// The visually-hidden recipe (NOT display:none, which hides from screen readers too).
const SR_ONLY =
  'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0'

/**
 * Split an element's text into animatable chars / words / lines WITHOUT breaking
 * accessibility: a screen reader still reads the whole text (once), copy/paste
 * is intact, and emoji stay whole. Feed the returned arrays to core's stagger().
 */
export function split(element: HTMLElement, options: SplitOptions = {}): Split {
  const types = options.type ?? ['words']
  const wantChars = types.includes('chars')
  const wantLines = types.includes('lines')
  const a11y = options.a11y ?? 'copy'
  const locale = options.locale
  const watchResize = options.resize ?? wantLines

  const originalHTML = element.innerHTML
  const text = element.textContent ?? ''

  const chars: HTMLElement[] = []
  const words: HTMLElement[] = []
  const lines: HTMLElement[] = []
  let pieces: HTMLElement = element // reassigned in buildPieces
  let reverted = false

  const buildPieces = (): void => {
    chars.length = 0
    words.length = 0
    lines.length = 0
    pieces = document.createElement('span')
    pieces.className = 'u-text'
    if (a11y !== 'off') pieces.setAttribute('aria-hidden', 'true')

    for (const token of text.split(/(\s+)/)) {
      if (token === '') continue
      if (/^\s+$/.test(token)) {
        pieces.appendChild(document.createTextNode(token)) // keep whitespace between words
        continue
      }
      const word = document.createElement('span')
      word.className = 'u-text__word'
      word.style.display = 'inline-block'
      if (wantChars) {
        for (const grapheme of graphemes(token, locale)) {
          const char = document.createElement('span')
          char.className = 'u-text__char'
          char.style.display = 'inline-block'
          char.textContent = grapheme
          word.appendChild(char)
          chars.push(char)
        }
      } else {
        word.textContent = token
      }
      pieces.appendChild(word)
      words.push(word)
    }
  }

  const mount = (): void => {
    element.replaceChildren()
    if (a11y === 'copy') {
      const readable = document.createElement('span')
      readable.style.cssText = SR_ONLY
      readable.innerHTML = originalHTML // preserves nested markup for screen readers + copy
      element.appendChild(readable)
    } else if (a11y === 'label') {
      element.setAttribute('aria-label', text)
    }
    element.appendChild(pieces)
  }

  // Lines are a LAYOUT fact: group words by their offsetTop, then box each group.
  const measureLines = (): void => {
    if (!wantLines || words.length === 0) return
    const tops = words.map((word) => word.offsetTop) // all reads first
    const groups: HTMLElement[][] = []
    let prev = Number.NaN
    words.forEach((word, i) => {
      const top = tops[i] ?? 0
      if (groups.length === 0 || Math.abs(top - prev) > 1) groups.push([])
      groups[groups.length - 1]!.push(word)
      prev = top
    })
    for (const group of groups) {
      const line = document.createElement('span')
      line.className = 'u-text__line'
      line.style.display = 'block'
      const first = group[0]!
      const last = group[group.length - 1]!
      pieces.insertBefore(line, first)
      const move: ChildNode[] = []
      let node: ChildNode | null = first
      while (node !== null) {
        move.push(node)
        if (node === last) break
        node = node.nextSibling
      }
      for (const child of move) line.appendChild(child) // words + the whitespace between them
      lines.push(line)
    }
  }

  const build = (): void => {
    buildPieces()
    mount()
    measureLines()
  }
  const reSplit = (): void => {
    if (!reverted) build()
  }

  build()

  // Web fonts change metrics -> line wrapping. Re-measure once they settle.
  if (wantLines && typeof document !== 'undefined' && 'fonts' in document) {
    void document.fonts.ready.then(reSplit)
  }

  // Width changes invalidate line membership; debounce and ignore height.
  let observer: ResizeObserver | null = null
  let timer = 0
  if (watchResize && wantLines && typeof ResizeObserver !== 'undefined') {
    let lastWidth = element.getBoundingClientRect().width
    observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? lastWidth
      if (width === lastWidth) return
      lastWidth = width
      clearTimeout(timer)
      timer = window.setTimeout(reSplit, 200)
    })
    observer.observe(element)
  }

  return {
    chars,
    words,
    lines,
    revert() {
      if (reverted) return
      reverted = true
      observer?.disconnect()
      clearTimeout(timer)
      element.innerHTML = originalHTML
      if (a11y === 'label') element.removeAttribute('aria-label')
      chars.length = 0
      words.length = 0
      lines.length = 0
    },
  }
}
