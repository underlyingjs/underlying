import { animatable, bindStyle, easeOutCubic, prefersReducedMotion } from '@underlying/core'
import { playable } from '@underlying/core/playback'
import { createTimeline } from '@underlying/timeline'
import type { ScrollController } from '@underlying/scroll'

// Beat 07 - one timeline. The honest hinge before the close: every section so far
// was live and interruptible; this one BAKES on purpose, and says so. A product
// card assembles itself on a real, seekable timeline - drag the playhead or scrub
// the page and it runs forward and backward frame-exact, landing on the same state
// at the same time every pass; hit play and the same sequence runs on its own
// clock; 0.5x replays it at half speed, identical choreography. Time-addressable is
// the trade you make for a live spring - and underlying gives you both.

interface BuildDeps {
  mount: HTMLElement
  scroll: ScrollController
  fireCredit: (text: string) => void
}

export function initBuild({ mount, scroll, fireCredit }: BuildDeps): void {
  const section = document.createElement('section')
  section.className = 'beat beat--build'
  section.setAttribute('data-beat', '07')
  section.innerHTML = `
    <div class="beat__rail">07 / one timeline</div>
    <div class="score">
      <header class="score__lede">
        <h2 class="score__head">One sequence. Every pass identical.</h2>
        <p class="score__sub">Drag the playhead. Scrub it anywhere. It lands the same.</p>
      </header>
      <div class="score__stage">
        <article class="card" data-card aria-label="A card assembling itself on a timeline">
          <span class="card__avatar" data-avatar></span>
          <h3 class="card__title" data-title>Weekly report ready</h3>
          <ul class="card__bars">
            <li class="card__bar"><i data-bar style="width:72%"></i></li>
            <li class="card__bar"><i data-bar style="width:48%"></i></li>
            <li class="card__bar"><i data-bar style="width:90%"></i></li>
          </ul>
          <span class="card__cta" data-cta>View report</span>
        </article>
      </div>
      <div class="score__transport">
        <button class="score__play" data-play type="button">play</button>
        <div class="score__track" data-track>
          <span class="score__fill" data-fill></span>
          <span class="score__mark" data-mark="metrics">metrics</span>
          <span class="score__mark" data-mark="confirm">confirm</span>
          <i class="score__playhead" data-playhead></i>
        </div>
        <button class="score__rate" data-rate type="button" aria-pressed="false">0.5x</button>
        <p class="score__clock"><span data-now>0</span> / <span data-total>0</span> ms</p>
      </div>
      <p class="score__verdict">Same input, same frame, every time - the trade you make for a live spring.</p>
    </div>
  `
  mount.appendChild(section)

  const q = <T extends Element>(sel: string): T => {
    const el = section.querySelector(sel)
    if (el === null) throw new Error(`underlyi.ng: beat 07 missing ${sel}`)
    return el as T
  }
  const card = q<HTMLElement>('[data-card]')
  const avatar = q<HTMLElement>('[data-avatar]')
  const title = q<HTMLElement>('[data-title]')
  const cta = q<HTMLElement>('[data-cta]')
  const bars = Array.from(section.querySelectorAll<HTMLElement>('[data-bar]'))
  const track = q<HTMLElement>('[data-track]')
  const fill = q<HTMLElement>('[data-fill]')
  const playhead = q<HTMLElement>('[data-playhead]')
  const playBtn = q<HTMLButtonElement>('[data-play]')
  const rateBtn = q<HTMLButtonElement>('[data-rate]')
  const nowEl = q<HTMLElement>('[data-now]')
  const totalEl = q<HTMLElement>('[data-total]')

  // Each piece of the card is a value the timeline drives.
  const cardOp = animatable(0)
  const cardY = animatable(14)
  const avOp = animatable(0)
  const avScale = animatable(0.6)
  const titleOp = animatable(0)
  const titleY = animatable(10)
  const ctaOp = animatable(0)
  const ctaScale = animatable(0.85)
  const barVals = bars.map(() => animatable(0))
  bindStyle(card, { opacity: cardOp, y: cardY })
  bindStyle(avatar, { opacity: avOp, scale: avScale })
  bindStyle(title, { opacity: titleOp, y: titleY })
  bindStyle(cta, { opacity: ctaOp, scale: ctaScale })
  bars.forEach((bar, i) => bindStyle(bar, { scaleX: barVals[i] }))

  // The sequence. Authored once; seekable, replayable, frame-exact.
  const tl = createTimeline()
  tl.label('panel', 0)
  tl.fromTo(cardOp, 0, 1, { at: 0, duration: 320, easing: easeOutCubic })
  tl.fromTo(cardY, 14, 0, { at: 0, duration: 400, easing: easeOutCubic })
  tl.label('avatar', 240)
  tl.fromTo(avOp, 0, 1, { at: 240, duration: 240 })
  tl.fromTo(avScale, 0.6, 1, { at: 240, duration: 320, easing: easeOutCubic })
  tl.fromTo(titleOp, 0, 1, { at: 400, duration: 280 })
  tl.fromTo(titleY, 10, 0, { at: 400, duration: 340, easing: easeOutCubic })
  tl.label('metrics', 600)
  tl.stagger(barVals, (value) => playable(value).to(1, { duration: 260, easing: easeOutCubic, paused: true }), {
    each: 110,
    at: 600,
  })
  tl.label('confirm', 980)
  tl.fromTo(ctaOp, 0, 1, { at: 980, duration: 260 })
  tl.fromTo(ctaScale, 0.85, 1, { at: 980, duration: 340, easing: easeOutCubic })

  const total = Math.round(tl.duration())
  totalEl.textContent = String(total)

  // Place the labels on the track at their real times.
  for (const mark of section.querySelectorAll<HTMLElement>('[data-mark]')) {
    const at = tl.labelTime(mark.dataset.mark ?? '')
    if (at !== undefined && total > 0) mark.style.left = `${(at / total) * 100}%`
  }

  const updateTransport = (p: number): void => {
    fill.style.transform = `scaleX(${p})`
    playhead.style.left = `${p * 100}%`
    nowEl.textContent = String(Math.round(p * total))
  }

  let dragging = false
  let playing = false
  let scrubCredited = false

  // Drag the playhead (raw pointer math on the track), time-addressable.
  const seekFromPointer = (clientX: number): void => {
    const box = track.getBoundingClientRect()
    const ratio = box.width > 0 ? (clientX - box.left) / box.width : 0
    const p = Math.max(0, Math.min(1, ratio))
    tl.progress(p)
    updateTransport(p)
  }
  track.style.touchAction = 'none'
  track.addEventListener('pointerdown', (event) => {
    dragging = true
    playing = false
    try {
      track.setPointerCapture(event.pointerId)
    } catch {
      // best-effort
    }
    if (!scrubCredited) {
      scrubCredited = true
      fireCredit('@underlying/timeline - scrub, frame-exact and reversible')
    }
    seekFromPointer(event.clientX)
  })
  track.addEventListener('pointermove', (event) => {
    if (dragging) seekFromPointer(event.clientX)
  })
  const endDrag = (): void => {
    dragging = false
  }
  track.addEventListener('pointerup', endDrag)
  track.addEventListener('pointercancel', endDrag)

  // Play on the timeline's own clock; read it back each frame to move the transport.
  const tick = (): void => {
    if (!playing) return
    const p = tl.progress()
    updateTransport(p)
    if (p >= 1) {
      playing = false
      playBtn.textContent = 'replay'
      return
    }
    requestAnimationFrame(tick)
  }
  playBtn.addEventListener('click', () => {
    if (prefersReducedMotion()) {
      tl.progress(1)
      updateTransport(1)
      return
    }
    if (playing) {
      tl.pause()
      playing = false
      playBtn.textContent = 'play'
      return
    }
    if (tl.progress() >= 1) tl.seek(0)
    playing = true
    playBtn.textContent = 'pause'
    fireCredit('@underlying/timeline - play, on its own clock')
    tl.play()
    requestAnimationFrame(tick)
  })

  let half = false
  rateBtn.addEventListener('click', () => {
    half = !half
    tl.timeScale(half ? 0.5 : 1)
    rateBtn.setAttribute('aria-pressed', String(half))
    rateBtn.classList.toggle('is-on', half)
    if (half) fireCredit('@underlying/timeline - timeScale, half speed')
  })

  // Scroll scrubs the same timeline when you are not dragging or playing.
  scroll.scrub(
    (p) => {
      if (dragging || playing) return
      if (!scrubCredited && p > 0.02) {
        scrubCredited = true
        fireCredit('@underlying/timeline - scrub, frame-exact and reversible')
      }
      tl.progress(p)
      updateTransport(p)
    },
    { target: section, range: ['start center', 'center center'] },
  )

  tl.progress(0)
  updateTransport(0)
}
