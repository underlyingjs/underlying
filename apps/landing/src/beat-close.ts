import type { ScrollController } from '@underlying/scroll'

// The close - the honest part. The whole page argued that motion should be live
// and interruptible. Here it admits the one place that liveness is traded away:
// when you need a time-addressable timeline (scrub to a frame, replay exactly),
// you bake. underlying ships both and is straight about which is which. Then the
// install line, the docs link, and an interruptible scrollTo that returns you to
// the top - the loop closing on the wordmark it opened with.

interface CloseDeps {
  mount: HTMLElement
  scroll: ScrollController
  fireCredit: (text: string) => void
}

export function initClose({ mount, scroll, fireCredit }: CloseDeps): void {
  const section = document.createElement('section')
  section.className = 'beat beat--close'
  section.setAttribute('data-beat', '09')
  section.innerHTML = `
    <div class="beat__rail">09 / the honest part</div>
    <div class="close">
      <h2 class="close__head">Scrub it when you need <em>time</em>.<br />Grab it when you need to <em>bend</em>.</h2>
      <p class="close__body">A timeline is addressable and exact, and it cannot be interrupted. A live value bends to your hand and never replays the same, and you cannot scrub it to a frame. underlying ships both - and the chip in the corner named which one was firing the whole way down.</p>
      <div class="close__cta">
        <button class="close__install" data-install type="button" aria-label="Copy the install command">
          <span class="close__prompt">npm i</span> @underlying/core
          <span class="close__copied" data-copied role="status" aria-live="polite">copied</span>
        </button>
        <a class="close__link" href="https://docs.underlyi.ng">Documentation</a>
        <a class="close__gh" href="https://github.com/underlyingjs/underlying" target="_blank" rel="noreferrer" aria-label="underlying on GitHub">
          <svg class="close__gh-mark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.13-.31-.54-1.53.11-3.19 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.19.77.84 1.23 1.91 1.23 3.23 0 4.63-2.81 5.65-5.49 5.95.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 22.29 24 17.8 24 12.5 24 5.87 18.63.5 12 .5z"/></svg>
          <span>GitHub</span>
        </a>
      </div>
      <button class="close__top" data-top type="button">back to the top</button>
      <p class="close__mark" aria-hidden="true">underlyi<span class="close__dot">.</span>ng</p>
    </div>
  `
  mount.appendChild(section)

  const pick = <T extends Element>(selector: string): T => {
    const el = section.querySelector(selector)
    if (el === null) throw new Error(`underlyi.ng: close missing ${selector}`)
    return el as T
  }
  const install = pick<HTMLButtonElement>('[data-install]')
  const copied = pick<HTMLElement>('[data-copied]')
  const top = pick<HTMLButtonElement>('[data-top]')

  // Click the install line to copy it; a brief "copied" confirms.
  let copiedTimer: ReturnType<typeof setTimeout> | undefined
  install.addEventListener('click', () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard !== undefined) {
      void navigator.clipboard.writeText('npm i @underlying/core').then(() => {
        copied.classList.add('is-shown')
        clearTimeout(copiedTimer)
        copiedTimer = setTimeout(() => copied.classList.remove('is-shown'), 1400)
      })
    }
  })

  // Back to the top: an interruptible spring scroll. A wheel or drag mid-flight
  // re-aims it (velocity conserved); it closes the loop on the hero.
  top.addEventListener('click', () => {
    fireCredit('@underlying/scroll - scrollTo, interruptible')
    scroll.scrollTo(0)
  })
}
