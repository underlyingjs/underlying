import './styles.scss'
import { animatable, bindStyle, bindTemplate, prefersReducedMotion, template, type Simulation } from '@underlying/core'
import { cursor, depth, draggable } from '@underlying/gestures'
import { createScroll, marquee } from '@underlying/scroll'
import { morph, type MorphElement } from '@underlying/svg'
import { reveal, typewriter } from '@underlying/text'
import { initProof } from './beat-proof'
import { initRail } from './beat-rail'
import { initGallery } from './beat-gallery'
import { initSheet } from './beat-sheet'
import { initNumbers } from './beat-numbers'
import { initRoute } from './beat-route'
import { initBuild } from './beat-build'
import { initPanorama } from './beat-panorama'
import { initClose } from './beat-close'

// Two organic closed outlines the blobs morph between forever; morph() resamples
// them so the path commands need not match.
const BLOB_A = 'M110 30 C150 32 186 58 188 104 C190 150 162 186 116 190 C70 194 36 160 32 116 C28 72 62 28 110 30 Z'
const BLOB_B = 'M112 24 C162 28 196 72 188 118 C180 164 146 196 100 188 C54 180 30 144 38 96 C46 48 62 20 112 24 Z'

const app = document.getElementById('app')
if (app === null) throw new Error('underlyi.ng: no #app')

app.innerHTML = `
  <a class="skip-link" href="#content">Skip to the content</a>
  <div class="page-ambient" data-page-ambient aria-hidden="true">
    <svg class="page-blob page-blob--a" viewBox="0 0 220 220"><path data-pblob-a d="${BLOB_A}" /></svg>
    <svg class="page-blob page-blob--b" viewBox="0 0 220 220"><path data-pblob-b d="${BLOB_B}" /></svg>
    <div class="page-sweep" data-page-sweep></div>
  </div>
  <main class="page" id="content" tabindex="-1">
    <section class="hero" aria-labelledby="hero-word">
      <div class="hero__rail">00 / hero</div>
      <div class="hero__ambient" data-ambient aria-hidden="true">
        <svg class="hero__blob" viewBox="0 0 220 220" preserveAspectRatio="xMidYMid meet">
          <path data-blob d="${BLOB_A}" />
        </svg>
        <div class="hero__sheen" data-sheen></div>
      </div>
      <div class="hero__field" data-field>
        <h1 class="hero__word" id="hero-word">underlyi.ng</h1>
        <p class="hero__thesis" data-thesis aria-label="Most animation is a recording. This bends."></p>
        <span class="hero__grab" data-grab>grab the dot, throw it</span>
        <i class="hero__disc" data-disc aria-hidden="true"><i class="hero__disc-core"></i></i>
      </div>
      <div class="hero__cue" aria-hidden="true">scroll</div>
      <div class="credit" data-credit>
        <span class="credit__dot"></span><span data-credit-text>physics-first web animation</span>
      </div>
    </section>
    <div class="marquee-band" aria-hidden="true">
      <div class="marquee-band__track" data-marquee-track>
        <span>physics-first</span><span>live values</span><span>interruptible</span><span>scroll as a source</span><span>spring &middot; decay &middot; simulate</span><span>never a recording</span>
      </div>
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
const disc = pick<HTMLElement>('[data-disc]')
const core = pick<HTMLElement>('.hero__disc-core')
const thesis = pick<HTMLElement>('[data-thesis]')
const grab = pick<HTMLElement>('[data-grab]')
const credit = pick<HTMLElement>('[data-credit]')
const creditText = pick<HTMLElement>('[data-credit-text]')
const ambient = pick<HTMLElement>('[data-ambient]')
const blobPath = pick<SVGPathElement>('[data-blob]')
const sheen = pick<HTMLElement>('[data-sheen]')
const pageAmbient = pick<HTMLElement>('[data-page-ambient]')
const pblobA = pick<SVGPathElement>('[data-pblob-a]')
const pblobB = pick<SVGPathElement>('[data-pblob-b]')
const pageSweepEl = pick<HTMLElement>('[data-page-sweep]')
const marqueeTrack = pick<HTMLElement>('[data-marquee-track]')

// The live feature-credit chip: lights the instant a feature fires, so the page
// reads as self-documenting dogfooding.
let creditTimer: ReturnType<typeof setTimeout> | undefined
const fireCredit = (text: string): void => {
  creditText.textContent = text
  credit.classList.add('credit--lit')
  clearTimeout(creditTimer)
  creditTimer = setTimeout(() => credit.classList.remove('credit--lit'), 1500)
}

// The living hero - motion that runs on its own, plus pointer depth, so the page
// is alive the instant you arrive and reacts as you move the cursor. All of it is
// held still under reduced motion (perpetual motion is exactly what that asks us
// not to run).
if (!prefersReducedMotion()) {
  // A blob morphs forever between two organic shapes (@underlying/svg): the fraction
  // oscillates 0..1 on a perpetual, undamped Simulation.
  const blob = morph(blobPath as unknown as MorphElement, BLOB_B, { closed: true, samples: 72 })
  const pulse: Simulation = { acceleration: (f) => -0.4 * (f - 0.5), rest: () => null }
  blob.fraction.simulate(pulse, { velocity: 0 })

  // An ambient light sweep: a conic-gradient angle that rotates forever, composed
  // onto a custom property by bindTemplate from one live value.
  const sweep = animatable(0)
  bindTemplate(sheen, '--sweep', template`${sweep}deg`)
  sweep.simulate({ acceleration: () => 0, rest: () => null }, { velocity: 14 })

  // Pointer depth: two layers parallax against the cursor - the ambient drifts most
  // (far), the field least (near) - a 2.5D illusion that makes the hero respond.
  depth(ambient, { shift: 44 })
  depth(field, { shift: 14 })

  // The PAGE-WIDE living background: two more blobs morphing forever behind EVERY
  // section (opposite phases), a second slow sweep, and its own pointer depth - so
  // the whole page breathes, not just the hero. The sections sit transparent over it.
  const perpetual: Simulation = { acceleration: (f) => -0.32 * (f - 0.5), rest: () => null }
  morph(pblobA as unknown as MorphElement, BLOB_B, { closed: true, samples: 60 }).fraction.simulate(perpetual, {
    velocity: 0,
  })
  morph(pblobB as unknown as MorphElement, BLOB_A, { closed: true, samples: 60, from: 1 }).fraction.simulate(perpetual, {
    velocity: 0,
  })
  const pageSweep = animatable(0)
  bindTemplate(pageSweepEl, '--sweep', template`${pageSweep}deg`)
  pageSweep.simulate({ acceleration: () => 0, rest: () => null }, { velocity: 7 })
  depth(pageAmbient, { shift: 26 })

  // A custom cursor trails the pointer and swells over interactive targets.
  cursor()

  fireCredit('@underlying/svg morph + gestures depth + cursor - the page breathes')
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
  // The breath never rests by design; under reduced motion we leave the disc still
  // (a perpetual animation is exactly what that setting asks us not to run).
  if (prefersReducedMotion()) return
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

// The disc seats on the wordmark's period - a real character that reveal() splits
// out; placeDisc measures that char's span. Until the reveal runs there is no
// anchor (and the disc is hidden anyway), so it is a no-op.
let periodAnchor: HTMLElement | null = null
const placeDisc = (): void => {
  if (periodAnchor === null) return
  const fontSize = parseFloat(getComputedStyle(word).fontSize)
  const size = Math.max(13, Math.round(fontSize * 0.12))
  disc.style.width = `${size}px`
  disc.style.height = `${size}px`

  const d = periodAnchor.getBoundingClientRect()
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
      grab.classList.remove('is-shown')
      grab.classList.add('is-gone')
    }
  },
  onEnd: () => fireCredit('@underlying/gestures - spring home, velocity conserved'),
})

// The thesis types itself in, the full sentence its accessible name throughout.
// Only once it has finished do we invite the grab - the opening reads title, then
// thesis, then the call to play, never all at once.
const startThesis = (): void => {
  fireCredit('@underlying/text - typewriter')
  void typewriter(thesis, 'Most animation is a recording. This bends.', { duration: 2200 }).finished.then(() => {
    thesis.classList.add('is-typed')
    if (!everGrabbed) grab.classList.add('is-shown')
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

// Sequence the opening once the display face is in: the wordmark reveals letter by
// letter on springs (split + reveal), with the period char held transparent so the
// live disc can draw it. Once the letters land, the disc falls onto the baseline
// and the thesis types in.
void document.fonts?.ready.then(() => {
  // The arrival pace lives here: `each` is the gap between letters (ms) and the
  // soft spring (lower stiffness) lets each one float in slowly. Widen `each` to
  // slow it further; tighten it to quicken.
  const revealed = reveal(word, {
    by: 'chars',
    each: 58,
    from: { y: 26, opacity: 0 },
    stiffness: 150,
    damping: 19,
  })
  word.style.opacity = '1'
  fireCredit('@underlying/text - split, staggered reveal')
  periodAnchor = revealed.split.chars.find((char) => char.textContent === '.') ?? null
  periodAnchor?.style.setProperty('color', 'transparent')
  // The wordmark is in by ~1s; drop the period onto its slot as the letters finish,
  // then type the thesis.
  window.setTimeout(() => {
    placeDisc()
    dropIn()
  }, 1050)
  window.setTimeout(startThesis, 1400)
})

// Below the hero: one scroll controller drives the page. Beat 01 proves the
// thesis (live vs baked); beat 02 exhibits it as horizontal-from-vertical scroll.
// Every beat mounts inside the single <main> landmark, after the hero.
const pageMain = pick<HTMLElement>('#content')
const scroll = createScroll()
initProof({ mount: pageMain, scroll, fireCredit })
initRail({ mount: pageMain, scroll, fireCredit })
initGallery({ mount: pageMain, scroll, fireCredit })
initSheet({ mount: pageMain, scroll, fireCredit })
initNumbers({ mount: pageMain, scroll, fireCredit })
initRoute({ mount: pageMain, scroll, fireCredit })
initBuild({ mount: pageMain, scroll, fireCredit })
initPanorama({ mount: pageMain, scroll, fireCredit })
initClose({ mount: pageMain, scroll, fireCredit })

// A manifesto ticker that drifts forever and speeds up / reverses with the scroll
// (coupled to scroll.velocity) - always-moving text right under the hero. Off under
// reduced motion, paused on hover, handled inside marquee().
if (!prefersReducedMotion()) {
  marquee(marqueeTrack, { speed: 34, velocity: scroll.velocity(), velocityFactor: 0.6 })
  fireCredit('@underlying/scroll - marquee, velocity-coupled')
}

// Each beat becomes a named region, so a screen reader can jump between them by
// landmark instead of scrolling blind through nine full-height sections.
let regionN = 0
for (const beat of pageMain.querySelectorAll('section.beat')) {
  const heading = beat.querySelector('h2')
  if (heading === null) continue
  if (heading.id === '') heading.id = `region-${++regionN}`
  beat.setAttribute('aria-labelledby', heading.id)
}
