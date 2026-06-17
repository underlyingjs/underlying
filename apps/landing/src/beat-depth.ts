import { animatable, bindStyle } from '@underlying/core'
import type { ScrollController } from '@underlying/scroll'

// Beat 05 - depth, in type. Three words of one phrase - "scroll into depth" - live
// on three planes over a FIXED dotted grid. One scroll value drives all three, but
// each reads it at its own rate (0.3x / 0.6x / 1.0x, labeled), so over a long span
// the words slide past the still grid and past each other at visibly different
// speeds: the faint far word barely drifts, the bold near word races. The phrase
// stretches and re-stacks as you scroll. Big type, long travel, the difference is
// the point - and it is the depth.

interface DepthDeps {
  mount: HTMLElement
  scroll: ScrollController
  fireCredit: (text: string) => void
}

const WORDS = [
  { text: 'scroll', plane: 'far', rate: 0.3, label: '0.3x' },
  { text: 'into', plane: 'mid', rate: 0.6, label: '0.6x' },
  { text: 'depth', plane: 'near', rate: 1.0, label: '1.0x' },
]

export function initDepth({ mount, scroll, fireCredit }: DepthDeps): void {
  const rows = WORDS.map(
    (w) =>
      `<div class="depth__row depth__row--${w.plane}" data-row>
        <span class="depth__word">${w.text}</span>
        <span class="depth__rate">${w.label}</span>
      </div>`,
  ).join('')

  const section = document.createElement('section')
  section.className = 'beat beat--depth'
  section.setAttribute('data-beat', '05')
  section.innerHTML = `
    <div class="depth-stage" data-stage>
      <div class="beat__rail">05 / depth</div>
      <header class="depth__lede">
        <h2 class="depth__head">Scroll into depth.</h2>
        <p class="depth__sub">Keep scrolling - one value, three rates. The slow word is far, the fast one is near.</p>
      </header>
      <div class="depth__viewport">
        <div class="depth__grid" aria-hidden="true"></div>
        <div class="depth__words">${rows}</div>
      </div>
      <footer class="depth__foot">
        <p class="depth__claim">Same scroll, three rates - that difference is depth. Scroll back and the phrase re-stacks.</p>
      </footer>
    </div>
  `
  mount.appendChild(section)

  const stage = section.querySelector<HTMLElement>('[data-stage]')
  if (stage === null) throw new Error('underlyi.ng: beat 05 markup')
  const rowEls = Array.from(section.querySelectorAll<HTMLElement>('[data-row]'))

  // One value; each word reads it at its own rate. The grid behind never moves.
  const ys = WORDS.map(() => animatable(0))
  rowEls.forEach((el, i) => {
    const y = ys[i]
    if (y !== undefined) bindStyle(el, { y })
  })

  // A long pin span, so the differential plays out over real scrolling.
  const measure = (): void => {
    section.style.height = `${Math.round(window.innerHeight * 3.6)}px`
  }

  let announced = false
  scroll.scrub(
    (p) => {
      if (!announced && p > 0.001) {
        announced = true
        fireCredit('@underlying/scroll - scrub, one value at three rates')
      }
      const centered = p - 0.5
      const travel = 320
      WORDS.forEach((w, i) => {
        ys[i]?.set(centered * travel * w.rate)
      })
    },
    { target: section, range: ['start start', 'end end'] },
  )

  measure()
  window.addEventListener('resize', () => {
    measure()
    scroll.refresh()
  })
  void document.fonts?.ready.then(() => {
    measure()
    scroll.refresh()
  })
}
