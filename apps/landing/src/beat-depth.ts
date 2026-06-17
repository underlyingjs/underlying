import { animatable, bindStyle } from '@underlying/core'
import type { ScrollController } from '@underlying/scroll'

// Beat 05 - depth, shown honestly. A FIXED dotted grid is the reference; three
// distinct, deliberate shapes sit over it - a far ring, a mid card, a near dot -
// each tagged with its rate (0.3x / 0.6x / 1.0x). One scroll value drives all
// three, but each reads it at its own rate, so they slide past the still grid and
// past each other at visibly different speeds. That difference IS depth. Scroll
// back up and they re-stack. No moving backdrop - the background never moves.

interface DepthDeps {
  mount: HTMLElement
  scroll: ScrollController
  fireCredit: (text: string) => void
}

const LAYERS = [
  { shape: 'ring', rate: 0.3, label: '0.3x' },
  { shape: 'card', rate: 0.62, label: '0.6x' },
  { shape: 'dot', rate: 1.0, label: '1.0x' },
]

export function initDepth({ mount, scroll, fireCredit }: DepthDeps): void {
  const columns = LAYERS.map(
    (layer) =>
      `<div class="depth__layer" data-layer>
        <span class="depth__shape depth__shape--${layer.shape}"></span>
        <span class="depth__rate">${layer.label}</span>
      </div>`,
  ).join('')

  const section = document.createElement('section')
  section.className = 'beat beat--depth'
  section.setAttribute('data-beat', '05')
  section.innerHTML = `
    <div class="depth-stage" data-stage>
      <div class="beat__rail">05 / depth</div>
      <header class="depth__lede">
        <h2 class="depth__head">One scroll. Three speeds.</h2>
        <p class="depth__sub">The same scroll value, read at three rates - the slow one reads as far, the fast one as near.</p>
      </header>
      <div class="depth__viewport">
        <div class="depth__grid" aria-hidden="true"></div>
        <div class="depth__layers">${columns}</div>
      </div>
      <footer class="depth__foot">
        <p class="depth__claim">Same scroll, three rates - that difference is depth. Scroll up and they re-stack.</p>
      </footer>
    </div>
  `
  mount.appendChild(section)

  const stage = section.querySelector<HTMLElement>('[data-stage]')
  if (stage === null) throw new Error('underlyi.ng: beat 05 markup')
  const layerEls = Array.from(section.querySelectorAll<HTMLElement>('[data-layer]'))

  // One value; each layer reads it at its own rate. The grid behind them never moves.
  const ys = LAYERS.map(() => animatable(0))
  layerEls.forEach((el, i) => {
    const y = ys[i]
    if (y !== undefined) bindStyle(el, { y })
  })

  const measure = (): void => {
    section.style.height = `${Math.round(window.innerHeight * 2.2)}px`
  }

  let announced = false
  scroll.scrub(
    (p) => {
      if (!announced && p > 0.001) {
        announced = true
        fireCredit('@underlying/scroll - scrub, one value at three rates')
      }
      const centered = p - 0.5
      const travel = 210
      LAYERS.forEach((layer, i) => {
        ys[i]?.set(centered * travel * layer.rate)
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
