import { animatable, bindStyle } from '@underlying/core'
import type { ScrollController } from '@underlying/scroll'

// Beat 05 - depth. The calm, hands-off breath after two interactive demos: a pinned
// stage holds while you scroll, and ONE scroll-driven value separates three layers
// into planes - a back wash, the held card, and the spec chips - each reading the
// same value at its own depth. The card barely moves (it holds still while the page
// moves around it); the planes drift around it and reverse exactly when you scroll
// back up. Three thirds of the span light the matching claim and chips - copy wired
// to scroll, no position math.

interface DepthDeps {
  mount: HTMLElement
  scroll: ScrollController
  fireCredit: (text: string) => void
}

export function initDepth({ mount, scroll, fireCredit }: DepthDeps): void {
  const section = document.createElement('section')
  section.className = 'beat beat--depth'
  section.setAttribute('data-beat', '05')
  section.innerHTML = `
    <div class="depth-stage" data-stage>
      <div class="beat__rail">05 / depth</div>
      <header class="depth__lede">
        <h2 class="depth__head">One value. Three depths.</h2>
        <p class="depth__sub">Scroll - the same number moves every layer at its own rate.</p>
      </header>
      <div class="depth__wash" data-wash aria-hidden="true"></div>
      <figure class="depth__card" data-card>
        <span class="depth__chip depth__chip--a" data-chip>live</span>
        <span class="depth__chip depth__chip--b" data-chip>interruptible</span>
        <span class="depth__chip depth__chip--c" data-chip>scroll-driven</span>
        <div class="depth__face"></div>
      </figure>
      <div class="depth__script">
        <p class="depth__claim" data-claim>The card barely moves.</p>
        <p class="depth__claim" data-claim>The wash drifts slow behind it.</p>
        <p class="depth__claim" data-claim>The chips race in front.</p>
      </div>
      <p class="depth__why">One scroll value, three planes - reverse it and they all come back.</p>
    </div>
  `
  mount.appendChild(section)

  const stage = section.querySelector<HTMLElement>('[data-stage]')
  const wash = section.querySelector<HTMLElement>('[data-wash]')
  const card = section.querySelector<HTMLElement>('[data-card]')
  if (stage === null || wash === null || card === null) throw new Error('underlyi.ng: beat 05 markup')
  const chips = Array.from(section.querySelectorAll<HTMLElement>('[data-chip]'))
  const claims = Array.from(section.querySelectorAll<HTMLElement>('[data-claim]'))

  // One value behind every plane. The three layers read it at different rates: the
  // card barely moves, the wash drifts down, the chips drift up - so they separate
  // into depth as you scroll, and snap back together at the middle.
  const washY = animatable(0)
  const cardY = animatable(0)
  const chipY = animatable(0)
  bindStyle(wash, { y: washY })
  bindStyle(card, { y: cardY })
  for (const chip of chips) bindStyle(chip, { y: chipY })

  let active = -1
  const setActive = (index: number): void => {
    if (index === active) return
    active = index
    claims.forEach((claim, i) => claim.classList.toggle('is-live', i === index))
    chips.forEach((chip, i) => chip.classList.toggle('is-live', i <= index)) // chips accumulate as you go
    fireCredit('@underlying/scroll - trigger, scroll-spy')
  }

  // The vertical scroll budget the sticky stage dwells over.
  const measure = (): void => {
    section.style.height = `${Math.round(window.innerHeight * 2.2)}px`
  }

  let announced = false
  scroll.scrub(
    (p) => {
      if (!announced && p > 0.001) {
        announced = true
        fireCredit('@underlying/scroll - scrub, parallax depth layers')
      }
      const c = p - 0.5
      // dramatic separation: the card holds still, the wash drifts down behind it,
      // the chips race up in front - all from the same value.
      washY.set(c * 110)
      cardY.set(c * 6)
      chipY.set(c * -170)
      setActive(Math.max(0, Math.min(2, Math.floor(p * 3))))
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
