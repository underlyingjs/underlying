import { animatable, bindStyle } from '@underlying/core'
import type { ScrollController } from '@underlying/scroll'

// Beat 05 - depth. The calm, hands-off breath: a pinned stage in three clear bands
// (title / a bounded parallax viewport / one narrating line). ONE scroll-driven
// value moves three layers at different rates - the card barely moves, the wash
// drifts behind it, the chips race in front - and the viewport clips them, so the
// depth reads without anything ever colliding with the title. Scroll back up and
// every plane reverses.

interface DepthDeps {
  mount: HTMLElement
  scroll: ScrollController
  fireCredit: (text: string) => void
}

const CLAIMS = ['The card barely moves.', 'The wash drifts slow behind it.', 'The chips race in front.']

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
      <div class="depth__viewport">
        <div class="depth__wash" data-wash aria-hidden="true"></div>
        <figure class="depth__card" data-card>
          <span class="depth__chip depth__chip--a" data-chip>live</span>
          <span class="depth__chip depth__chip--b" data-chip>interruptible</span>
          <span class="depth__chip depth__chip--c" data-chip>scroll-driven</span>
          <div class="depth__face"></div>
        </figure>
      </div>
      <footer class="depth__foot">
        <p class="depth__claim" data-claim>${CLAIMS[0]}</p>
        <p class="depth__why">One scroll value, three planes - reverse it and they all come back.</p>
      </footer>
    </div>
  `
  mount.appendChild(section)

  const stage = section.querySelector<HTMLElement>('[data-stage]')
  const wash = section.querySelector<HTMLElement>('[data-wash]')
  const card = section.querySelector<HTMLElement>('[data-card]')
  const claim = section.querySelector<HTMLElement>('[data-claim]')
  if (stage === null || wash === null || card === null || claim === null) throw new Error('underlyi.ng: beat 05 markup')
  const chips = Array.from(section.querySelectorAll<HTMLElement>('[data-chip]'))

  // One value behind every plane, each reading it at its own rate.
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
    claim.textContent = CLAIMS[index] ?? ''
    chips.forEach((chip, i) => chip.classList.toggle('is-live', i <= index))
    fireCredit('@underlying/scroll - trigger, scroll-spy')
  }

  const measure = (): void => {
    section.style.height = `${Math.round(window.innerHeight * 2.2)}px`
  }

  let announced = false
  scroll.scrub(
    (p) => {
      if (!announced && p > 0.001) {
        announced = true
        fireCredit('@underlying/scroll - scrub, parallax depth')
      }
      const c = p - 0.5
      // bounded drift - the viewport clips it, so nothing escapes its band
      washY.set(c * 84)
      cardY.set(c * 6)
      chipY.set(c * -104)
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
