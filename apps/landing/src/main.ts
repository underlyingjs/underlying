import './styles.scss'
import { animatable, bindStyle, type Simulation } from '@underlying/core'
import { draggable } from '@underlying/gestures'
import { createScroll } from '@underlying/scroll'
import { typewriter } from '@underlying/text'
import { initProof } from './beat-proof'
import { initRail } from './beat-rail'
import { initGallery } from './beat-gallery'
import { initSheet } from './beat-sheet'
import { initDepth } from './beat-depth'
import { initRoute } from './beat-route'
import { initBuild } from './beat-build'
import { initPanorama } from './beat-panorama'
import { initClose } from './beat-close'

const app = document.getElementById('app')
if (app === null) throw new Error('underlyi.ng: no #app')

app.innerHTML = `
  <main class="hero">
    <div class="hero__rail">00 / hero</div>
    <div class="hero__field">
      <h1 class="hero__word">underlyi<span class="hero__dot">.</span>ng</h1>
      <p class="hero__thesis" data-thesis aria-label="Most animation is a recording. This bends."></p>
      <span class="hero__grab" data-grab>grab the dot, throw it</span>
      <i class="hero__disc" data-disc aria-hidden="true"><i class="hero__disc-core"></i></i>
    </div>
    <div class="hero__cue" aria-hidden="true">scroll</div>
    <div class="credit" data-credit>
      <span class="credit__dot"></span><span data-credit-text>physics-first web animation</span>
    </div>
  </main>
`

const pick = <T extends Element>(selector: string): T => {
  const el = app.querySelector(selector)
  if (el === null) throw new Error(`underlyi.ng: missing ${selector}`)
  return el as T
}

const field = pick<HTMLElement>('.hero__field')
const word = pick<HTMLElement>('.hero__word')
const dot = pick<HTMLElement>('.hero__dot')
const disc = pick<HTMLElement>('[data-disc]')
const core = pick<HTMLElement>('.hero__disc-core')
const thesis = pick<HTMLElement>('[data-thesis]')
const grab = pick<HTMLElement>('[data-grab]')
const credit = pick<HTMLElement>('[data-credit]')
const creditText = pick<HTMLElement>('[data-credit-text]')

// The live feature-credit chip: lights the instant a feature fires, so the page
// reads as self-documenting dogfooding.
let creditTimer: ReturnType<typeof setTimeout> | undefined
const fireCredit = (text: string): void => {
  creditText.textContent = text
  credit.classList.add('credit--lit')
  clearTimeout(creditTimer)
  creditTimer = setTimeout(() => credit.classList.remove('credit--lit'), 1500)
}

// The protagonist disc IS the wordmark's period made physical. Three live values
// share its inner core through one transform: it falls onto the baseline (a
// spring), then breathes forever (an undamped Simulation), and it fades in as it
// arrives so it reads as landing, not teleporting.
const drop = animatable(-220) // vertical offset from the baseline home, px; starts above
const fade = animatable(0) // hidden until the fall begins
const breath = animatable(1) // perpetual scale oscillation around 1
bindStyle(core, { y: drop, scale: breath, opacity: fade })

const oscillator: Simulation = { acceleration: (position) => -6 * (position - 1), rest: () => null }
const startBreath = (): void => {
  breath.simulate(oscillator, { velocity: 0.18 })
}

// Size the disc to the wordmark's real period and seat it on the text baseline,
// re-measured when the face swaps in (font load) or the viewport resizes. Font
// metrics come from a canvas context so the seam tracks the actual glyph, not a
// magic offset that would drift as the clamp() font-size scales.
let measureCtx: CanvasRenderingContext2D | null | undefined
const periodMetrics = (): { ascent: number; descent: number; rise: number } => {
  const cs = getComputedStyle(word)
  const size = parseFloat(cs.fontSize)
  if (measureCtx === undefined) measureCtx = document.createElement('canvas').getContext('2d')
  if (measureCtx === null) return { ascent: size * 0.8, descent: size * 0.2, rise: size * 0.06 }
  measureCtx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  const m = measureCtx.measureText('.')
  const ascent = m.fontBoundingBoxAscent || size * 0.8
  const descent = m.fontBoundingBoxDescent || size * 0.2
  const rise = ((m.actualBoundingBoxAscent || size * 0.07) - (m.actualBoundingBoxDescent || 0)) / 2
  return { ascent, descent, rise }
}

const placeDisc = (): void => {
  const fontSize = parseFloat(getComputedStyle(word).fontSize)
  const size = Math.max(13, Math.round(fontSize * 0.12))
  disc.style.width = `${size}px`
  disc.style.height = `${size}px`

  const d = dot.getBoundingClientRect()
  const w = word.getBoundingClientRect()
  const f = field.getBoundingClientRect()
  const { ascent, descent, rise } = periodMetrics()
  // baseline within a single line box: half-leading (can be negative) plus ascent
  const baselineFromTop = w.height / 2 + (ascent - descent) / 2
  const cx = d.left - f.left + d.width / 2
  const cy = w.top - f.top + baselineFromTop - rise
  disc.style.left = `${cx - size / 2}px`
  disc.style.top = `${cy - size / 2}px`
}
placeDisc()
void document.fonts?.ready.then(placeDisc)
window.addEventListener('resize', placeDisc)

// Grab the dot and throw it: the pointer velocity is handed into a spring back
// home, so it overshoots on your momentum and settles. Grab it again mid-return
// and it retargets from its live velocity - it bends, never restarts.
let everGrabbed = false
draggable(disc, {
  release: 'spring',
  spring: { stiffness: 150, damping: 14 },
  onStart: () => {
    fireCredit('@underlying/gestures - draggable')
    if (!everGrabbed) {
      everGrabbed = true
      grab.classList.add('is-gone')
    }
  },
  onEnd: () => fireCredit('@underlying/gestures - spring home, velocity conserved'),
})

// The thesis types itself in, the full sentence its accessible name throughout.
const startThesis = (): void => {
  fireCredit('@underlying/text - typewriter')
  void typewriter(thesis, 'Most animation is a recording. This bends.', { duration: 2200 }).finished.then(() => {
    thesis.classList.add('is-typed')
  })
}

// The period falls onto the baseline and settles, then begins to breathe. The
// spring's velocity is conserved into the overshoot; only once it rests does the
// perpetual breath take over.
const dropIn = (): void => {
  fireCredit('@underlying/core - spring')
  void fade.to(1, { duration: 220 })
  void drop.spring(0, { stiffness: 150, damping: 16 }).finished.then(startBreath)
}

// Sequence the opening once the display face is in: re-seat the period on the
// real glyph metrics, type the thesis, then let the period fall.
void document.fonts?.ready.then(() => {
  placeDisc()
  window.setTimeout(startThesis, 200)
  window.setTimeout(dropIn, 900)
})

// Below the hero: one scroll controller drives the page. Beat 01 proves the
// thesis (live vs baked); beat 02 exhibits it as horizontal-from-vertical scroll.
const scroll = createScroll()
initProof({ mount: app, scroll, fireCredit })
initRail({ mount: app, scroll, fireCredit })
initGallery({ mount: app, scroll, fireCredit })
initSheet({ mount: app, scroll, fireCredit })
initDepth({ mount: app, scroll, fireCredit })
initRoute({ mount: app, scroll, fireCredit })
initBuild({ mount: app, scroll, fireCredit })
initPanorama({ mount: app, scroll, fireCredit })
initClose({ mount: app, scroll, fireCredit })
