import type { Simulation } from '@underlying/core'
import { draggable, type Draggable } from '@underlying/gestures'
import type { ScrollController } from '@underlying/scroll'

// Beat 01 - the proof. Two identical pucks fall together as you scroll. One is a
// recording: scroll teleports it frame-exact and a poke is overwritten the moment
// you let go. The other is a live value: scroll springs it toward the same target,
// and your throw is handed in as release velocity so it overshoots and settles -
// grab it mid-return and it retargets from its live velocity. Same look, until you
// touch them: one ignores you and snaps back to the script, one bends.

interface ProofDeps {
  mount: HTMLElement
  scroll: ScrollController
  fireCredit: (text: string) => void
}

const MARKUP = `
  <div class="beat__rail">01 / proof</div>
  <div class="proof">
    <header class="proof__lede">
      <h2 class="proof__head">Two falls. One is a recording.</h2>
      <p class="proof__sub">Scroll drops them together. Then grab one.</p>
    </header>
    <div class="proof__stage">
      <figure class="lane lane--baked">
        <span class="lane__tag">recorded</span>
        <div class="lane__track" data-track-baked>
          <i class="puck" data-puck-baked></i>
          <span class="lane__base"></span>
        </div>
        <p class="lane__readout"><span class="lane__vel" data-vel-baked>0.0</span> u/s</p>
        <figcaption class="lane__note" data-note-baked>grab it, it snaps back</figcaption>
      </figure>
      <figure class="lane lane--live">
        <span class="lane__tag">live</span>
        <div class="lane__track" data-track-live>
          <i class="puck" data-puck-live></i>
          <span class="lane__base"></span>
        </div>
        <p class="lane__readout"><span class="lane__vel" data-vel-live>0.0</span> u/s</p>
        <figcaption class="lane__note" data-note-live>grab it, it bends</figcaption>
      </figure>
    </div>
    <p class="proof__verdict" data-verdict aria-live="polite"></p>
  </div>
`

export function initProof({ mount, scroll, fireCredit }: ProofDeps): void {
  const section = document.createElement('section')
  section.className = 'beat beat--proof'
  section.setAttribute('data-beat', '01')
  section.innerHTML = MARKUP
  mount.appendChild(section)

  const pick = <T extends Element>(selector: string): T => {
    const el = section.querySelector(selector)
    if (el === null) throw new Error(`underlyi.ng: beat 01 missing ${selector}`)
    return el as T
  }
  const bakedPuck = pick<HTMLElement>('[data-puck-baked]')
  const livePuck = pick<HTMLElement>('[data-puck-live]')
  const lane = pick<HTMLElement>('[data-track-baked]')
  const bakedVel = pick<HTMLElement>('[data-vel-baked]')
  const liveVel = pick<HTMLElement>('[data-vel-live]')
  const bakedNote = pick<HTMLElement>('[data-note-baked]')
  const liveNote = pick<HTMLElement>('[data-note-live]')
  const verdict = pick<HTMLElement>('[data-verdict]')

  // The scroll-follow is smooth (no bounce while you scrub); the release is
  // livelier, so a throw visibly overshoots and springs back - the bend you feel.
  const chaseSpring = { stiffness: 120, damping: 18 }
  // On release the live puck BOUNCES off the floor: gravity pulls it down onto the
  // baseline (scrollTarget) and a stiff, damped floor pushes it back up, losing
  // energy each hit - it lands on the line and bounces, instead of springing down
  // through it. A couple of decaying bounces, then it rests on the floor.
  const GRAVITY = 2600
  const FLOOR_STIFFNESS = 8000
  const FLOOR_DAMPING = 52
  // Bounds are mutated in place on each measure; draggable re-reads them per grab.
  const bakedBounds = { y: [0, 0] as [number, number] }
  const liveBounds = { y: [0, 0] as [number, number] }

  // How far a puck falls: the lane height minus the puck's own size.
  let travel = 0
  const measure = (): void => {
    travel = Math.max(0, lane.clientHeight - bakedPuck.offsetHeight)
    bakedBounds.y = [0, travel]
    liveBounds.y = [0, travel]
  }

  let scrollTarget = 0
  let bakedDragging = false
  let liveDragging = false
  let pokedBaked = false
  let pokedLive = false

  const showVerdict = (text: string): void => {
    verdict.textContent = text
    verdict.classList.add('is-shown')
  }
  const settle = (): void => {
    if (pokedBaked && pokedLive) showVerdict('Same look. Only one of them is still listening.')
  }

  // The recording: a poke is overwritten the instant you release - it snaps back
  // to whatever the scrollbar says, your throw ignored. release:'free' keeps
  // draggable from animating, so the snap is ours and absolute.
  const bakedDrag: Draggable = draggable(bakedPuck, {
    axis: 'y',
    release: 'free',
    bounds: bakedBounds,
    onStart: () => {
      bakedDragging = true
      fireCredit('@underlying/gestures - draggable')
    },
    onEnd: () => {
      bakedDragging = false
      bakedDrag.y.set(scrollTarget) // snap back to the script
      pokedBaked = true
      bakedNote.classList.add('is-revealed')
      if (!pokedLive) showVerdict('The recording ignored you and snapped back to the script.')
      settle()
      fireCredit('@underlying/scroll - locked scrub, frame-exact')
    },
  })

  // The live value: your release velocity is handed into a spring back toward the
  // scroll-driven target, so it overshoots and settles. Grab it mid-return and it
  // retargets from its live velocity. It bends, never restarts.
  const liveDrag: Draggable = draggable(livePuck, {
    axis: 'y',
    release: 'free',
    bounds: liveBounds,
    edgeResistance: 0.85,
    onStart: () => {
      liveDragging = true
      fireCredit('@underlying/gestures - draggable')
    },
    onEnd: ({ y: velocity }) => {
      liveDragging = false
      const floor = scrollTarget
      const bounce: Simulation = {
        acceleration: (position, currentVelocity) => {
          const below = position - floor
          return below > 0 ? GRAVITY - FLOOR_STIFFNESS * below - FLOOR_DAMPING * currentVelocity : GRAVITY
        },
        rest: (position, currentVelocity) => (position >= floor - 0.4 && Math.abs(currentVelocity) < 7 ? floor : null),
      }
      liveDrag.y.simulate(bounce, { velocity })
      pokedLive = true
      liveNote.classList.add('is-revealed')
      if (!pokedBaked) showVerdict('The live one took your throw and kept its velocity home.')
      settle()
      fireCredit('@underlying/core - simulate, a real bounce off the floor')
    },
  })

  // The unfakeable proof: the live value's velocity integrates 0 -> spike -> 0,
  // while the recording teleports, so its velocity reads zero every frame.
  bakedDrag.y.on('change', () => {
    bakedVel.textContent = Math.abs(bakedDrag.y.velocity()).toFixed(1)
  })
  liveDrag.y.on('change', () => {
    liveVel.textContent = Math.abs(liveDrag.y.velocity()).toFixed(1)
  })
  liveDrag.y.on('rest', () => {
    liveVel.textContent = '0.0'
  })

  // Scroll drops them together: one value each, the same target, opposite physics.
  // A raw callback is always locked, so the recording is frame-exact and the live
  // value's spring owns the frames in between, retargeting only as scroll moves.
  scroll.scrub(
    (p) => {
      scrollTarget = p * travel
      if (!bakedDragging) bakedDrag.y.set(scrollTarget)
      if (!liveDragging) liveDrag.y.spring(scrollTarget, chaseSpring)
    },
    { target: section, range: ['start end', 'center center'] },
  )
  fireCredit('@underlying/scroll - scrub')

  measure()
  window.addEventListener('resize', measure)
  void document.fonts?.ready.then(() => {
    measure()
    scroll.refresh()
  })
}
