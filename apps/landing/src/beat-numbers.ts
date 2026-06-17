import { animatable, bindStyle } from '@underlying/core'
import type { ScrollController } from '@underlying/scroll'

// Beat 05 - by the numbers. The "stats band" every product landing ships, but the
// figures are real facts about the toolkit and they count up with a spring (not a
// linear tween) the moment the band enters view: a scroll trigger fires once, each
// number springs from 0 to its value, and the zero pops in. Recognizable pattern,
// honest numbers, physics-first reveal.

interface NumbersDeps {
  mount: HTMLElement
  scroll: ScrollController
  fireCredit: (text: string) => void
}

const STATS = [
  { to: 7, suffix: '', label: 'packages, one core' },
  { to: 0, suffix: '', label: 'runtime dependencies' },
  { to: 60, suffix: '', label: 'fps, one shared loop' },
  { to: 100, suffix: '%', label: 'of values interruptible' },
]

export function initNumbers({ mount, scroll, fireCredit }: NumbersDeps): void {
  const cells = STATS.map(
    (stat) =>
      `<div class="nums__cell" data-cell>
        <span class="nums__value" data-value>0${stat.suffix}</span>
        <span class="nums__label">${stat.label}</span>
      </div>`,
  ).join('')

  const section = document.createElement('section')
  section.className = 'beat beat--numbers'
  section.setAttribute('data-beat', '05')
  section.innerHTML = `
    <div class="beat__rail">05 / by the numbers</div>
    <div class="nums">
      <header class="nums__lede">
        <h2 class="nums__head">Physics-first, and it weighs almost nothing.</h2>
        <p class="nums__sub">One core, seven packages, zero dependencies - every value interruptible.</p>
      </header>
      <div class="nums__grid">${cells}</div>
    </div>
  `
  mount.appendChild(section)

  const cells_ = Array.from(section.querySelectorAll<HTMLElement>('[data-cell]'))
  const valueEls = Array.from(section.querySelectorAll<HTMLElement>('[data-value]'))

  // Each cell reveals with a springy pop; each value counts up on its own spring.
  const reveals = STATS.map((stat, i) => {
    const cell = cells_[i]
    const valueEl = valueEls[i]
    const opacity = animatable(0)
    const scale = animatable(0.72)
    const count = animatable(0)
    if (cell !== undefined) bindStyle(cell, { opacity, scale })
    count.on('change', () => {
      if (valueEl !== undefined) valueEl.textContent = `${Math.round(count.get())}${stat.suffix}`
    })
    return { opacity, scale, count, to: stat.to }
  })

  let revealed = false
  scroll.trigger(section, {
    onEnter: () => {
      if (revealed) return
      revealed = true
      fireCredit('@underlying/scroll - trigger; @underlying/core - spring the count')
      reveals.forEach((r, i) => {
        window.setTimeout(() => {
          r.opacity.spring(1, { stiffness: 200, damping: 16 })
          r.scale.spring(1, { stiffness: 220, damping: 15 }) // a small pop
          // critically damped so the count rises and settles, no odd overshoot (8, 102%...)
          if (r.to > 0) r.count.spring(r.to, { stiffness: 90, damping: 20 })
        }, i * 110)
      })
    },
  })
}
