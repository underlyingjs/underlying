import { prefersReducedMotion } from '@underlying/core'
import { flip } from '@underlying/flip'
import type { ScrollController } from '@underlying/scroll'

// Beat 03 - the gallery. The grid-to-detail transition every portfolio, shop and
// media app ships: click a frame and it grows from its grid slot into a full-width
// hero, the rest dim; click again and it flies back. flip() inverts every moved
// frame's position AND size in one pass (no flash) and springs them home. Because
// it is a spring, not a recording, clicking again mid-flight retargets from the
// live position and velocity - open and close are the same motion, and you can
// catch it half-open and bend it into the close. No jump, no restart.

interface GalleryDeps {
  mount: HTMLElement
  scroll: ScrollController
  fireCredit: (text: string) => void
}

const FRAMES = [
  { id: 'a', cap: 'Still 01' },
  { id: 'b', cap: 'Still 02' },
  { id: 'c', cap: 'Still 03' },
  { id: 'd', cap: 'Still 04' },
  { id: 'e', cap: 'Still 05' },
  { id: 'f', cap: 'Still 06' },
]

export function initGallery({ mount, fireCredit }: GalleryDeps): void {
  // A real <button> inside each <li>: the list keeps its listitem semantics and the
  // control gets native button keyboard handling (Enter/Space) and focus, instead of
  // an <li role="button"> that announces neither well.
  const tiles = FRAMES.map(
    (f) =>
      `<li class="frame frame--${f.id}" data-frame data-id="${f.id}">
        <button class="frame__hit" type="button" data-hit aria-label="Open ${f.cap}">
          <i class="frame__plate"></i><span class="frame__cap">${f.cap}</span>
        </button>
      </li>`,
  ).join('')

  const section = document.createElement('section')
  section.className = 'beat beat--gallery'
  section.setAttribute('data-beat', '03')
  section.innerHTML = `
    <div class="beat__rail">03 / the gallery</div>
    <div class="gallery">
      <header class="gallery__lede">
        <h2 class="gallery__head">Open it. Then close it before it lands.</h2>
        <p class="gallery__sub">Click a frame to open. Click it again to close - even mid-flight.</p>
      </header>
      <ul class="gallery__grid" data-grid data-mode="grid">${tiles}</ul>
      <p class="gallery__verdict" data-verdict aria-live="polite"></p>
    </div>
  `
  mount.appendChild(section)

  const grid = section.querySelector<HTMLElement>('[data-grid]')
  const verdict = section.querySelector<HTMLElement>('[data-verdict]')
  if (grid === null || verdict === null) throw new Error('underlyi.ng: beat 03 markup')
  const frames = Array.from(section.querySelectorAll<HTMLElement>('[data-frame]'))

  let openId: string | null = null
  let lastToggle = 0

  const applyLayout = (id: string | null): void => {
    openId = id
    grid.dataset.mode = id === null ? 'grid' : 'detail'
    for (const frame of frames) {
      const isOpen = frame.dataset.id === id
      frame.classList.toggle('is-open', isOpen)
      frame.classList.toggle('is-dim', id !== null && !isOpen)
    }
  }

  const showVerdict = (text: string): void => {
    verdict.textContent = text
    verdict.classList.add('is-shown')
  }

  const toggle = (id: string): void => {
    const now = performance.now()
    const interrupted = now - lastToggle < 450 // a second click while the spring is still running
    lastToggle = now
    const next = openId === id ? null : id

    if (prefersReducedMotion()) {
      applyLayout(next)
    } else {
      // The mutate is a pure layout swap (class + grid mode). flip owns the motion.
      flip(frames, () => applyLayout(next), { stiffness: 210, damping: 24 })
    }

    if (interrupted) {
      fireCredit('@underlying/flip - retarget from live velocity')
      showVerdict('You caught it mid-flight and it bent. No jump, no restart.')
    } else {
      fireCredit('@underlying/flip - position + size inverted')
      showVerdict('Open and close are the same spring, run backward.')
    }
  }

  for (const frame of frames) {
    const id = frame.dataset.id
    if (id === undefined) continue
    // The button is the control; native Enter/Space already dispatch click.
    const hit = frame.querySelector<HTMLButtonElement>('[data-hit]')
    hit?.addEventListener('click', () => toggle(id))
  }
}
