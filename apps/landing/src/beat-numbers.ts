import { animatable, bindStyle, bindTemplate, prefersReducedMotion, staggerDelay } from '@underlying/core'
import type { ScrollController } from '@underlying/scroll'

// Beat 05 - by the numbers. The "stats band" every product landing ships, but the
// figures are real facts about the toolkit, and the band BUILDS WITH THE SCROLL:
// each cell rises, scales and counts up tied to scroll position, in a center-out
// staggerDelay() wave - so it assembles as you scroll into it and UN-builds as you
// scroll back up. The reveal transform is composed by bindTemplate from one value.

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
  // Render the REAL figure statically: if JS never runs, the band reads the truth
  // (not a screenful of zeros). The scroll-linked count overwrites from 0.
  const cells = STATS.map(
    (stat) =>
      `<div class="nums__cell" data-cell>
        <span class="nums__value" data-value>${stat.to}${stat.suffix}</span>
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

  const cellEls = Array.from(section.querySelectorAll<HTMLElement>('[data-cell]'))
  const valueEls = Array.from(section.querySelectorAll<HTMLElement>('[data-value]'))

  // Each cell's reveal is ONE value 0..1. bindStyle binds the opacity; bindTemplate
  // composes the rise + scale transform from that same value (its function form).
  const reveals = cellEls.map((cell) => {
    const v = animatable(0)
    bindStyle(cell, { opacity: v })
    bindTemplate(cell, 'transform', [v], (t) => `translate3d(0px, ${(1 - t) * 36}px, 0px) scale(${0.55 + 0.45 * t})`)
    return v
  })
  const setCell = (i: number, t: number): void => {
    reveals[i]?.set(t)
    const stat = STATS[i]
    const el = valueEls[i]
    if (stat !== undefined && el !== undefined) el.textContent = `${Math.round(t * stat.to)}${stat.suffix}`
  }

  // Reduced motion: show the band fully revealed, no scroll-linked movement.
  if (prefersReducedMotion()) {
    for (let i = 0; i < reveals.length; i++) setCell(i, 1)
    return
  }

  // The wave is shaped by staggerDelay() but its unit is SCROLL PROGRESS, not ms:
  // each cell's reveal opens over [offset_i, offset_i + span] of the scroll range.
  const smooth = (t: number): number => t * t * (3 - 2 * t)
  const wave = staggerDelay({ each: 0.17, from: 'center' })
  const span = 0.42
  const grid = section.querySelector<HTMLElement>('.nums__grid') ?? section
  let credited = false
  scroll.scrub(
    (p) => {
      const total = reveals.length
      for (let i = 0; i < total; i++) {
        setCell(i, smooth(Math.min(1, Math.max(0, (p - wave(i, total)) / span))))
      }
      if (!credited && p > 0.02) {
        credited = true
        fireCredit('@underlying/core - staggerDelay wave (scroll-linked) + bindTemplate')
      }
    },
    { target: grid, range: ['start end', 'center center'] },
  )
}
