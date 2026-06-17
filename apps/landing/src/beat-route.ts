import { animatable } from '@underlying/core'
import { draw, morphCommands, motionPath } from '@underlying/svg'
import type { ScrollController } from '@underlying/scroll'

// Beat 06 - the route. The delivery / order-tracking screen, driven by ONE value:
// the route stroke draws on, a courier rides the same path facing its tangent, a
// status badge reshapes, and the ETA counts down - all reading the same live
// progress. Scroll sends it; or grab the courier and flick it forward on inertia,
// and the line, the badge and the ETA all track your hand, then the next scroll
// re-acquires the value without a jump. Draw, ride and reshape - the same number.

interface RouteDeps {
  mount: HTMLElement
  scroll: ScrollController
  fireCredit: (text: string) => void
}

const ROUTE_D = 'M 30 126 C 96 126 100 44 162 44 C 224 44 228 118 296 58'
const BADGE_BOX = 'M 280 44 L 304 44 L 304 68 L 280 68 Z'
const BADGE_DIAMOND = 'M 292 38 L 312 56 L 292 74 L 272 56 Z'

export function initRoute({ mount, scroll, fireCredit }: RouteDeps): void {
  const section = document.createElement('section')
  section.className = 'beat beat--route'
  section.setAttribute('data-beat', '06')
  section.innerHTML = `
    <div class="beat__rail">06 / the route</div>
    <div class="route-stage" data-stage>
      <header class="route__lede">
        <h2 class="route__head">One value drives the whole route.</h2>
        <p class="route__sub">Scroll to send it. Or grab the courier and flick it.</p>
      </header>
      <svg class="route__svg" viewBox="0 0 340 170" aria-hidden="true">
        <path class="route__ghost" d="${ROUTE_D}" />
        <path class="route__line" data-line d="${ROUTE_D}" />
        <circle class="route__depot" cx="30" cy="126" r="5" />
        <path class="route__badge" data-badge d="${BADGE_BOX}" />
        <g class="route__courier" data-courier>
          <circle class="route__courier-hit" r="16" />
          <path class="route__courier-arrow" d="M -7 -5 L 8 0 L -7 5 Z" />
        </g>
      </svg>
      <dl class="route__readout">
        <div class="route__cell"><dt>status</dt><dd data-status>at the depot</dd></div>
        <div class="route__cell"><dt>eta</dt><dd><span data-eta>14</span> min</dd></div>
      </dl>
      <p class="route__why">Draw, ride and reshape - the same number, your hand on it.</p>
    </div>
  `
  mount.appendChild(section)

  const stage = section.querySelector<HTMLElement>('[data-stage]')
  const line = section.querySelector<SVGPathElement>('[data-line]')
  const badge = section.querySelector<SVGPathElement>('[data-badge]')
  const courier = section.querySelector<SVGGElement>('[data-courier]')
  const statusEl = section.querySelector<HTMLElement>('[data-status]')
  const etaEl = section.querySelector<HTMLElement>('[data-eta]')
  if (!stage || !line || !badge || !courier || !statusEl || !etaEl) throw new Error('underlyi.ng: beat 06 markup')

  // One master progress. draw, motionPath and morphCommands each own their own
  // value; on every change we set all three plus the readout - one number, four
  // surfaces, never a scripted sequence.
  const progress = animatable(0)
  const stroke = draw(line, { from: 0 })
  const rider = motionPath(courier, line, { autoRotate: 90 })
  const reshape = morphCommands(badge, BADGE_DIAMOND, { from: 0 })

  const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
  let credited = false
  progress.on('change', () => {
    const p = progress.get()
    stroke.fraction.set(p)
    rider.t.set(p)
    reshape.fraction.set(clamp01((p - 0.6) / 0.4)) // the badge reshapes over the last leg
    statusEl.textContent = p < 0.04 ? 'at the depot' : p > 0.96 ? 'delivered' : 'on the way'
    etaEl.textContent = String(Math.max(0, Math.round((1 - p) * 14)))
    if (!credited && p > 0.02) {
      credited = true
      fireCredit('@underlying/svg - draw, motionPath, morphCommands on one value')
    }
  })

  // Scroll sends the value with a touch of weight; the same spring re-acquires it
  // after a flick, so a throw never snaps back.
  const chase = { stiffness: 300, damping: 30 }
  let flicking = false
  scroll.scrub(
    (p) => {
      if (!flicking) progress.spring(p, chase)
    },
    { target: section, range: ['start center', 'center center'] },
  )

  // Grab the courier and flick it forward: horizontal drag maps to progress, the
  // release velocity becomes an inertial glide bounded to the route.
  let grabX = 0
  let grabP = 0
  let lastX = 0
  let lastT = 0
  let velocity = 0
  const svgWidth = (): number => section.querySelector('.route__svg')?.getBoundingClientRect().width ?? 340
  courier.style.cursor = 'grab'
  courier.style.touchAction = 'none'
  courier.addEventListener('pointerdown', (event) => {
    flicking = true
    progress.stop()
    grabX = event.clientX
    grabP = progress.get()
    lastX = event.clientX
    lastT = event.timeStamp
    velocity = 0
    try {
      courier.setPointerCapture(event.pointerId)
    } catch {
      // best-effort
    }
    fireCredit('@underlying/gestures - grab the courier')
  })
  courier.addEventListener('pointermove', (event) => {
    if (!flicking) return
    const w = svgWidth()
    progress.set(clamp01(grabP + (event.clientX - grabX) / w))
    const dt = (event.timeStamp - lastT) / 1000
    if (dt > 0.008) {
      velocity = velocity * 0.4 + ((event.clientX - lastX) / w / dt) * 0.6
      lastX = event.clientX
      lastT = event.timeStamp
    }
  })
  const endFlick = (): void => {
    if (!flicking) return
    flicking = false
    progress.decay({ velocity, min: 0, max: 1 })
    fireCredit('@underlying/core - decay, your flick down the route')
  }
  courier.addEventListener('pointerup', endFlick)
  courier.addEventListener('pointercancel', endFlick)

  void document.fonts?.ready.then(() => scroll.refresh())
  window.addEventListener('resize', () => scroll.refresh())
}
