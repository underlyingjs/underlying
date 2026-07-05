import { animatable, bindStyle, bindTemplate, prefersReducedMotion, staggerDelay } from '@underlying/core'
import type { ScrollController } from '@underlying/scroll'

// Beat 08 - the panorama. The "what is in the box" grid: every package, one core
// underneath, each with its real version (read from package.json at build, never
// hand-typed). The grid BUILDS WITH THE SCROLL: each card rises and scales tied to
// scroll position, in a staggerDelay() wave that propagates across the real 2D grid
// by cell distance - so it assembles as you scroll in and UN-builds as you scroll
// back up. The reveal transform is composed by bindTemplate from one value.

interface PanoramaDeps {
  mount: HTMLElement
  scroll: ScrollController
  fireCredit: (text: string) => void
}

const PACKAGES = [
  { key: 'core', name: '@underlying/core', role: 'Springs, decay, custom physics. The one interruptible value everything else drives.' },
  { key: 'scroll', name: '@underlying/scroll', role: 'Scroll as a source: scrub, pin, parallax, snap, and a spring-driven scrollTo.' },
  { key: 'gestures', name: '@underlying/gestures', role: 'Drag, fling and snap. Your pointer velocity handed straight into the physics.' },
  { key: 'flip', name: '@underlying/flip', role: 'Layout and shared-element transitions that invert position and size, interruptible.' },
  { key: 'svg', name: '@underlying/svg', role: 'Ride a path, draw a line, morph a shape - command-preserving.' },
  { key: 'text', name: '@underlying/text', role: 'Accessible splitting and a physics-first reveal, the real text intact underneath.' },
  { key: 'timeline', name: '@underlying/timeline', role: 'Seekable, time-addressable sequences for when you need a frame, not a force.' },
  { key: 'utils', name: '@underlying/utils', role: 'Named eases, cubicBezier, and the small math - clamp, mapRange, interpolate, wrap.' },
  { key: 'react', name: '@underlying/react', role: 'Hooks that bind animate(), gestures, text and FLIP to a ref. Teardown on unmount.' },
  { key: 'vue', name: '@underlying/vue', role: 'Composables that bind the same to a template ref. Teardown on unmount.' },
  { key: 'angular', name: '@underlying/angular', role: 'Standalone directives that bind the same to your elements. Teardown on destroy.' },
]

export function initPanorama({ mount, scroll, fireCredit }: PanoramaDeps): void {
  const versions: Record<string, string> = typeof __PKG_VERSIONS__ === 'undefined' ? {} : __PKG_VERSIONS__
  const cards = PACKAGES.map(
    (p) =>
      `<li class="pkg" data-pkg>
        <span class="pkg__name">${p.name}</span>
        <p class="pkg__role">${p.role}</p>
        <span class="pkg__ver">${versions[p.key] ?? ''}</span>
      </li>`,
  ).join('')

  const section = document.createElement('section')
  section.className = 'beat beat--panorama'
  section.setAttribute('data-beat', '08')
  section.innerHTML = `
    <div class="beat__rail">08 / the box</div>
    <div class="panorama">
      <header class="panorama__lede">
        <h2 class="panorama__head">${PACKAGES.length} packages. One core.</h2>
        <p class="panorama__sub">Each adds a surface - now including React, Vue and Angular adapters. The physics is the same live value underneath.</p>
      </header>
      <ul class="panorama__grid">${cards}</ul>
    </div>
  `
  mount.appendChild(section)

  // Each card's reveal is ONE value 0..1. bindStyle binds the opacity; bindTemplate
  // composes the rise + scale transform from that same value (its function form).
  const cardEls = Array.from(section.querySelectorAll<HTMLElement>('[data-pkg]'))
  const reveals = cardEls.map((card) => {
    const v = animatable(0)
    bindStyle(card, { opacity: v })
    bindTemplate(card, 'transform', [v], (t) => `translate3d(0px, ${(1 - t) * 40}px, 0px) scale(${0.88 + 0.12 * t})`)
    return v
  })

  // Reduced motion: show the grid fully revealed, no scroll-linked movement.
  if (prefersReducedMotion()) {
    for (const v of reveals) v.set(1)
    return
  }

  // The wave is shaped by staggerDelay() across the real 2D grid, but its unit is
  // SCROLL PROGRESS: each card opens over [offset, offset + span] of the scroll
  // range, so the grid builds diagonally as it scrolls into the centre.
  const smooth = (t: number): number => t * t * (3 - 2 * t)
  const span = 0.4
  const grid = section.querySelector<HTMLElement>('.panorama__grid') ?? section
  let wave: ((index: number, total: number) => number) | null = null
  let credited = false
  scroll.scrub(
    (p) => {
      if (wave === null) {
        // The rendered column count: the cards sharing the first card's top edge.
        const firstTop = cardEls[0]?.offsetTop ?? 0
        const cols = Math.max(1, cardEls.filter((card) => card.offsetTop === firstTop).length)
        wave = staggerDelay({ each: 0.085, grid: { cols }, from: 'start' })
      }
      const total = reveals.length
      for (let i = 0; i < total; i++) {
        reveals[i]?.set(smooth(Math.min(1, Math.max(0, (p - wave(i, total)) / span))))
      }
      if (!credited && p > 0.02) {
        credited = true
        fireCredit('@underlying/core - staggerDelay grid wave (scroll-linked) + bindTemplate')
      }
    },
    { target: grid, range: ['start end', 'center center'] },
  )
}
