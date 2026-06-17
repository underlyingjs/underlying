import './styles.scss'
import { animatable, bindStyle, type Simulation } from '@underlying/core'
import { draggable } from '@underlying/gestures'
import { typewriter } from '@underlying/text'

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

// The protagonist disc breathes - a perpetual, lightly energetic oscillation
// around scale 1, driven by a bring-your-own Simulation (an undamped spring that
// never rests). It is never perfectly still.
const breath = animatable(1)
bindStyle(core, { scale: breath })
const oscillator: Simulation = { acceleration: (position) => -6 * (position - 1), rest: () => null }
breath.simulate(oscillator, { velocity: 0.18 })

// Place the disc exactly over the wordmark's dot, and follow the dot when the
// face swaps in (font load) or the viewport resizes.
const placeDisc = (): void => {
  const d = dot.getBoundingClientRect()
  const f = field.getBoundingClientRect()
  const size = disc.offsetWidth || 15
  disc.style.left = `${d.left - f.left + d.width / 2 - size / 2}px`
  disc.style.top = `${d.top - f.top + d.height / 2 - size / 2}px`
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
void document.fonts?.ready.then(() => setTimeout(startThesis, 450))
