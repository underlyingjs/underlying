import { animatable, bindStyle } from '@underlying/core'
import type { ScrollController } from '@underlying/scroll'

// Beat 08 - the panorama. The "what is in the box" grid: seven packages, one core
// underneath, each with its real version (read from package.json at build, never
// hand-typed). A scroll trigger fires once on enter and the cards spring up in a
// stagger - so the page reads as a full toolkit, not a one-trick demo, and earns
// the close's single `npm i @underlying/core`.

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
]

export function initPanorama({ mount, scroll, fireCredit }: PanoramaDeps): void {
  const versions: Record<string, string> = typeof __PKG_VERSIONS__ === 'undefined' ? {} : __PKG_VERSIONS__
  const cards = PACKAGES.map(
    (p) =>
      `<li class="pkg" data-pkg>
        <span class="pkg__name">${p.name}</span>
        <p class="pkg__role">${p.role}</p>
        <span class="pkg__ver">${versions[p.key] ?? 'beta'}</span>
      </li>`,
  ).join('')

  const section = document.createElement('section')
  section.className = 'beat beat--panorama'
  section.setAttribute('data-beat', '08')
  section.innerHTML = `
    <div class="beat__rail">08 / the box</div>
    <div class="panorama">
      <header class="panorama__lede">
        <h2 class="panorama__head">Seven packages. One core.</h2>
        <p class="panorama__sub">Each adds a surface. The physics is the same live value underneath.</p>
      </header>
      <ul class="panorama__grid">${cards}</ul>
    </div>
  `
  mount.appendChild(section)

  // Each card rises and fades in on its own pair of values; the stagger is just a
  // per-index delay before each spring starts.
  const reveals = Array.from(section.querySelectorAll<HTMLElement>('[data-pkg]')).map((card) => {
    const opacity = animatable(0)
    const y = animatable(18)
    bindStyle(card, { opacity, y })
    return { opacity, y }
  })

  let revealed = false
  scroll.trigger(section, {
    onEnter: () => {
      if (revealed) return
      revealed = true
      fireCredit('@underlying/scroll - trigger, on enter')
      reveals.forEach((r, i) => {
        window.setTimeout(() => {
          r.opacity.spring(1, { stiffness: 180, damping: 22 })
          r.y.spring(0, { stiffness: 180, damping: 20 })
        }, i * 70)
      })
    },
  })
}
