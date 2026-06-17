import { animatable, bindStyle } from '@underlying/core'
import type { ScrollController } from '@underlying/scroll'

// Beat 02 - the rail. Vertical scroll drives a horizontal filmstrip, and the rail
// is one live value with weight: the scroll springs the whole rail sideways (it
// lags then settles, never rigid), and you can grab it and throw it - your release
// velocity becomes an inertial glide that rubber-bands at the ends, then the next
// scroll re-acquires it without a snap. Scroll-driven AND interruptible, the same
// value, the same gesture.

interface RailDeps {
  mount: HTMLElement
  scroll: ScrollController
  fireCredit: (text: string) => void
}

const WORDS = ['scroll', 'drives', 'the', 'rail.', 'or', 'grab', 'it', 'and', 'throw', 'it.', 'one', 'live', 'value.']
const ACCENT_FROM = 8 // 'throw it. one live value.' carries the live accent

export function initRail({ mount, scroll, fireCredit }: RailDeps): void {
  const words = WORDS.map(
    (text, i) => `<span class="rail__word${i >= ACCENT_FROM ? ' rail__word--accent' : ''}">${text}</span>`,
  ).join('')

  const section = document.createElement('section')
  section.className = 'beat beat--rail'
  section.setAttribute('data-beat', '02')
  section.innerHTML = `
    <div class="rail-stage" data-stage>
      <div class="beat__rail">02 / the rail</div>
      <div class="rail" data-rail>${words}</div>
      <p class="rail__hint" data-hint>scroll moves the rail. or grab it and throw it.</p>
      <p class="rail__verdict" data-verdict aria-hidden="true">One live value - the scroll drives it, your hand bends it.</p>
    </div>
  `
  mount.appendChild(section)

  const pick = <T extends Element>(selector: string): T => {
    const el = section.querySelector(selector)
    if (el === null) throw new Error(`underlyi.ng: beat 02 missing ${selector}`)
    return el as T
  }
  const stage = pick<HTMLElement>('[data-stage]')
  const rail = pick<HTMLElement>('[data-rail]')
  const hint = pick<HTMLElement>('[data-hint]')
  const verdict = pick<HTMLElement>('[data-verdict]')

  // One live value carries the whole rail sideways. 0 at the start, -travel at the
  // end. The momentum on scroll and the inertia on a throw both live here.
  const railX = animatable(0)
  bindStyle(rail, { x: railX })

  // travel = how far the rail must slide so its end sits flush at the right edge;
  // the vertical scroll budget (the sticky dwell) is set to match it exactly.
  let travel = 0
  const measure = (): void => {
    const viewport = stage.clientWidth || window.innerWidth
    travel = Math.max(0, rail.scrollWidth - viewport)
    section.style.height = `${window.innerHeight + travel}px`
  }

  // Scroll drives the rail with real weight: a SOFT, underdamped spring, so during
  // a scroll the rail visibly trails your wheel, and the instant you stop it coasts
  // past and springs back - the elastic bounce. It rubber-bands at the ends and
  // re-acquires after a throw the same way. Soft enough that the lag/overshoot is
  // felt on a normal gradual scroll, not only on an instant jump.
  const masterSpring = { stiffness: 190, damping: 15 }
  let dragging = false
  let announced = false
  scroll.scrub(
    (p) => {
      if (!dragging) railX.spring(-p * travel, masterSpring)
      if (!announced && p > 0.001) {
        announced = true
        fireCredit('@underlying/scroll - scrub, with momentum')
      }
    },
    { target: section, range: ['start start', 'end end'] },
  )

  // Grab the rail and throw it: drive it from the pointer, track a smoothed release
  // velocity, hand it into an inertial glide that rubber-bands at the ends.
  // touch-action keeps vertical scroll native; only the horizontal throw is ours.
  stage.style.touchAction = 'pan-y'
  const clampRubber = (value: number, min: number, max: number): number => {
    if (value < min) return min - (min - value) * 0.5
    if (value > max) return max + (value - max) * 0.5
    return value
  }
  let grabX = 0
  let grabRail = 0
  let lastX = 0
  let lastT = 0
  let velocity = 0
  let moved = 0
  let thrown = false

  const onDown = (event: PointerEvent): void => {
    dragging = true
    moved = 0
    velocity = 0
    railX.stop()
    grabX = event.clientX
    grabRail = railX.get()
    lastX = event.clientX
    lastT = event.timeStamp
    try {
      stage.setPointerCapture(event.pointerId)
    } catch {
      // synthetic events / older engines: capture is best-effort
    }
    stage.classList.add('is-grabbing')
  }
  const onMove = (event: PointerEvent): void => {
    if (!dragging) return
    const delta = event.clientX - grabX
    moved = Math.max(moved, Math.abs(delta))
    railX.set(clampRubber(grabRail + delta, -travel, 0))
    const dt = (event.timeStamp - lastT) / 1000
    if (dt > 0.008) {
      const instant = (event.clientX - lastX) / dt
      velocity = velocity * 0.4 + instant * 0.6 // smoothed, so a held pause means no throw
      lastX = event.clientX
      lastT = event.timeStamp
    }
  }
  const onUp = (): void => {
    if (!dragging) return
    dragging = false
    stage.classList.remove('is-grabbing')
    railX.decay({ velocity, min: -travel, max: 0 })
    if (moved > 6) {
      fireCredit('@underlying/core - decay, your momentum + rubber-band')
      if (!thrown) {
        thrown = true
        hint.classList.add('is-gone')
        verdict.classList.add('is-shown')
        verdict.setAttribute('aria-hidden', 'false')
      }
    }
  }
  stage.addEventListener('pointerdown', onDown)
  stage.addEventListener('pointermove', onMove)
  stage.addEventListener('pointerup', onUp)
  stage.addEventListener('pointercancel', () => {
    dragging = false
    stage.classList.remove('is-grabbing')
  })

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
