import { draggable } from '@underlying/gestures'
import type { ScrollController } from '@underlying/scroll'

// Beat 04 - the sheet. The mobile bottom-sheet pattern under every maps, share and
// detail screen: grab it, drag it, fling it, and on release the throw velocity is
// projected forward and the nearest of three detents (peek / half / full) is chosen
// from where the momentum would land - a fast flick clears a stop, a slow drag
// settles on the nearest. The same live y value also drives the backdrop scrim, so
// the gesture is visibly ONE value moving two things, not a scripted sequence.

interface SheetDeps {
  mount: HTMLElement
  scroll: ScrollController
  fireCredit: (text: string) => void
}

export function initSheet({ mount, fireCredit }: SheetDeps): void {
  const section = document.createElement('section')
  section.className = 'beat beat--sheet'
  section.setAttribute('data-beat', '04')
  section.innerHTML = `
    <div class="beat__rail">04 / the sheet</div>
    <div class="sheet-stage">
      <header class="sheet__lede">
        <h2 class="sheet__head">A sheet that knows where your thumb is going.</h2>
        <p class="sheet__sub">Drag it. Fling it. It lands on a detent with your momentum.</p>
      </header>
      <div class="sheet-phone" data-phone>
        <div class="sheet-phone__app" aria-hidden="true">
          <span class="sheet-phone__line sheet-phone__line--wide"></span>
          <span class="sheet-phone__line"></span>
          <span class="sheet-phone__line sheet-phone__line--short"></span>
        </div>
        <div class="sheet-scrim" data-scrim></div>
        <div class="sheet" data-sheet role="group" aria-label="Trip details sheet">
          <button class="sheet__grip" data-grip type="button" aria-label="Sheet position: press to open further, arrow keys to adjust"></button>
          <div class="sheet__head-row">
            <span class="sheet__title">Trip details</span>
            <span class="sheet__detent" data-detent>peek</span>
          </div>
          <div class="sheet__body">
            <p class="sheet__row"><span>Route</span><span>14 min</span></p>
            <p class="sheet__row"><span>Arrive</span><span>9:42</span></p>
            <p class="sheet__row sheet__row--soft"><span>Distance</span><span>3.1 mi</span></p>
          </div>
        </div>
      </div>
      <p class="sheet__verdict">Three detents. One draggable. Your throw picks the stop.</p>
    </div>
  `
  mount.appendChild(section)

  const sheet = section.querySelector<HTMLElement>('[data-sheet]')
  const scrim = section.querySelector<HTMLElement>('[data-scrim]')
  const detentEl = section.querySelector<HTMLElement>('[data-detent]')
  const grip = section.querySelector<HTMLButtonElement>('[data-grip]')
  if (sheet === null || scrim === null || detentEl === null || grip === null)
    throw new Error('underlyi.ng: beat 04 markup')

  // y is the sheet's downward offset from full-open (0). Larger y = pushed further
  // down. The detents and bounds are measured in those pixels; full=0, peek shows
  // just a strip. Mutated in place so draggable re-reads them per grab/release.
  const SCRIM_MAX = 0.24
  let full = 0
  let half = 0
  let peek = 0
  const boundsY: [number, number] = [0, 0]
  const snapY: number[] = [0, 0, 0]

  const settleSpring = { stiffness: 320, damping: 30 }
  const drag = draggable(sheet, {
    axis: 'y',
    bounds: { y: boundsY },
    snap: { y: snapY }, // explicit detents, momentum-aware on release
    edgeResistance: 0.85, // rubber-band past full (top) and past peek (bottom)
    spring: settleSpring,
    onStart: () => fireCredit('@underlying/gestures - draggable, bounds + edge resistance'),
    onEnd: () => fireCredit('@underlying/gestures - momentum snap to the nearest detent'),
  })

  const detents = (): Array<{ y: number; name: string }> => [
    { y: full, name: 'full' },
    { y: half, name: 'half' },
    { y: peek, name: 'peek' },
  ]

  let scrimCredited = false
  const reflectValue = (): void => {
    const cur = drag.y.get()
    // one value, two elements: the scrim darkens toward sapin as the sheet rises
    const t = peek > 0 ? 1 - cur / peek : 0
    const clamped = Math.max(0, Math.min(1, t))
    scrim.style.opacity = String(clamped * SCRIM_MAX)
    scrim.style.pointerEvents = clamped > 0.12 ? 'auto' : 'none'
    if (!scrimCredited && clamped > 0.05) {
      scrimCredited = true
      fireCredit('@underlying/core - one live value drives the scrim')
    }
    const nearest = detents().reduce((a, b) => (Math.abs(b.y - cur) < Math.abs(a.y - cur) ? b : a))
    detentEl.textContent = nearest.name
  }
  drag.y.on('change', reflectValue)

  // Tap the exposed scrim (above the sheet) to dismiss back to peek.
  scrim.addEventListener('click', () => {
    drag.y.spring(peek, settleSpring)
  })

  // Keyboard parity for the grip: the three detents as openness levels (0 = peek,
  // closed; 2 = full, open). Arrows step between adjacent stops; pressing the grip
  // opens one stop further and wraps. Each lands on the same spring as a release,
  // and it re-reads the nearest stop first so it stays sane after a drag.
  const levelYs = (): number[] => [peek, half, full] // index 0 closed -> 2 open
  const nearestLevel = (): number => {
    const cur = drag.y.get()
    const ys = levelYs()
    let best = 0
    for (let i = 1; i < ys.length; i++) {
      if (Math.abs((ys[i] ?? 0) - cur) < Math.abs((ys[best] ?? 0) - cur)) best = i
    }
    return best
  }
  const goToLevel = (index: number): void => {
    const ys = levelYs()
    const clamped = Math.max(0, Math.min(ys.length - 1, index))
    drag.y.spring(ys[clamped] ?? peek, settleSpring)
    fireCredit('@underlying/gestures - keyboard to a detent')
  }
  grip.addEventListener('click', () => goToLevel((nearestLevel() + 1) % 3))
  grip.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault()
      goToLevel(nearestLevel() + 1)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault()
      goToLevel(nearestLevel() - 1)
    }
  })

  const measure = (): void => {
    const sheetHeight = sheet.offsetHeight
    full = 0
    peek = Math.max(0, Math.round(sheetHeight - 76)) // a 76px strip stays visible at peek
    half = Math.round(peek * 0.46)
    boundsY[0] = full
    boundsY[1] = peek
    snapY[0] = full
    snapY[1] = half
    snapY[2] = peek
    // keep it parked at peek (resting/closed) on first layout and on resize
    drag.y.set(peek)
    reflectValue()
  }
  measure()
  window.addEventListener('resize', measure)
  void document.fonts?.ready.then(measure)
}
