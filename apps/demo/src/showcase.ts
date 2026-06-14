// Docs engine: top bar, grouped sidebar, hash-routed content column, and a
// scroll-spy "on this page" panel. Below 820px the sidebar becomes a drawer.

import { animate } from '@underlying/core'

export interface DemoContext {
  stage: HTMLElement
  controls: HTMLElement
  onCleanup(fn: () => void): void
}

export interface Section {
  id: string
  /** Legacy grouping hint - ignored by the page-based renderer. */
  group?: string
  title: string
  tagline: string
  description: string
  code: string
  api?: string
  run(ctx: DemoContext): void
  noReplay?: boolean
}

export interface Page {
  id: string
  group: string
  title: string
  blurb?: string
  sections: Section[]
}

// --- tiny hyperscript ------------------------------------------------------

type Attrs = Record<string, string | number | boolean | EventListener | undefined>

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue
    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener)
    } else if (key === 'class') node.className = String(value)
    else if (key === 'html') node.innerHTML = String(value)
    else node.setAttribute(key, String(value))
  }
  for (const child of children) node.append(child)
  return node
}

// --- control helpers -------------------------------------------------------

export function button(label: string, onClick: () => void): HTMLButtonElement {
  return h('button', { class: 'btn', onClick }, label)
}

export function slider(
  label: string,
  opts: { min: number; max: number; value: number; step?: number; onInput: (value: number) => void },
): HTMLLabelElement {
  const out = h('span', { class: 'field__value' }, String(opts.value))
  const input = h('input', {
    class: 'field__input', type: 'range', min: opts.min, max: opts.max, step: opts.step ?? 1, value: opts.value,
    onInput: (event: Event) => {
      const value = Number((event.target as HTMLInputElement).value)
      out.textContent = String(value)
      opts.onInput(value)
    },
  })
  return h('label', { class: 'field field--slider' }, h('span', { class: 'field__label' }, label), input, out)
}

export function dropdown(
  label: string,
  options: Array<{ value: string; label: string }>,
  onChange: (value: string) => void,
): HTMLLabelElement {
  const select = h('select', { class: 'field__select', onChange: (event: Event) => onChange((event.target as HTMLSelectElement).value) })
  for (const option of options) select.append(h('option', { value: option.value }, option.label))
  return h('label', { class: 'field field--select' }, h('span', { class: 'field__label' }, label), select)
}

export function toggle(label: string, onChange: (checked: boolean) => void): HTMLLabelElement {
  const input = h('input', { class: 'field__check', type: 'checkbox', onChange: (event: Event) => onChange((event.target as HTMLInputElement).checked) })
  return h('label', { class: 'field field--toggle' }, input, h('span', { class: 'field__label' }, label))
}

// --- minimal TS syntax highlighter ----------------------------------------

const ESCAPE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }
const escapeHtml = (text: string): string => text.replace(/[&<>]/g, (c) => ESCAPE[c] ?? c)
const KEYWORDS =
  /\b(const|let|import|from|export|return|await|async|function|new|type|interface|if|else|for|of|in|void|true|false|null|undefined)\b/g

export function highlight(code: string): string {
  const tokenizer = /(\/\/[^\n]*)|(`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/g
  let out = ''
  let last = 0
  let match: RegExpExecArray | null
  const emit = (text: string): string =>
    escapeHtml(text)
      .replace(KEYWORDS, '<span class="tok tok--kw">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="tok tok--num">$1</span>')
      .replace(/([a-zA-Z_$][\w$]*)(\s*\()/g, '<span class="tok tok--fn">$1</span>$2')
  while ((match = tokenizer.exec(code)) !== null) {
    out += emit(code.slice(last, match.index))
    if (match[1] !== undefined) out += `<span class="tok tok--com">${escapeHtml(match[1])}</span>`
    else out += `<span class="tok tok--str">${escapeHtml(match[2] ?? '')}</span>`
    last = match.index + match[0].length
  }
  return out + emit(code.slice(last))
}

// --- renderer --------------------------------------------------------------

const ICON_MENU =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 6.5h18M3 12h18M3 17.5h18"/></svg>'
const ICON_CLOSE =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5.5 5.5l13 13M18.5 5.5l-13 13"/></svg>'
const ICON_GITHUB =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.16-.02-2.1-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z"/></svg>'

export function renderShowcase(pages: Page[], root: HTMLElement): void {
  const pageById = new Map(pages.map((page) => [page.id, page]))

  // Top bar -----------------------------------------------------------------
  // `tools` (badge + search) is display:contents on desktop and relocated into
  // the drawer on mobile (see syncViewport) - one container for both layouts.
  const search = h('input', { class: 'search__input', type: 'text', placeholder: 'Search...', spellcheck: false })
  const tools = h('div', { class: 'topbar__tools' },
    h('span', { class: 'topbar__badge' }, `v${__CORE_VERSION__}`),
    h('div', { class: 'search' }, search, h('span', { class: 'search__key' }, '/')),
  )
  const menuBtn = h('button', {
    class: 'topbar__menu', type: 'button', 'aria-label': 'Open navigation',
    'aria-expanded': 'false', 'aria-controls': 'site-nav', html: ICON_MENU,
  })
  const topbarInner = h('div', { class: 'topbar__inner' },
    menuBtn,
    h('a', {
      class: 'brand',
      href: `#/${pages[0]?.id ?? ''}`,
      'aria-label': 'underlying docs',
      html: `<img class="brand__word" src="/wordmark-sapin.svg" alt="underlying" /><small class="brand__sub">docs</small>`,
    }),
    tools,
    h('div', { class: 'topbar__spacer' }),
    h('nav', { class: 'topbar__links' },
      h('a', {
        class: 'topbar__link', href: 'https://github.com/underlyingjs/underlying',
        target: '_blank', rel: 'noopener', 'aria-label': 'GitHub repository',
        html: `<span class="topbar__link-icon">${ICON_GITHUB}</span><span class="topbar__link-text">GitHub</span>`,
      }),
    ),
  )
  const spacer = topbarInner.querySelector('.topbar__spacer') as HTMLElement
  const topbar = h('header', { class: 'topbar' }, topbarInner)

  // Sidebar -----------------------------------------------------------------
  const sidebar = h('aside', { class: 'sidebar', id: 'site-nav', tabindex: '-1' })
  const sideLinks = new Map<string, HTMLAnchorElement>()
  const groups = new Map<string, Page[]>()
  for (const page of pages) {
    const list = groups.get(page.group) ?? []
    list.push(page)
    groups.set(page.group, list)
  }
  for (const [group, list] of groups) {
    sidebar.append(h('div', { class: 'sidebar__group' }, group))
    for (const page of list) {
      const link = h('a', { class: 'sidebar__link', href: `#/${page.id}` }, page.title)
      sideLinks.set(page.id, link)
      sidebar.append(link)
    }
  }
  search.addEventListener('input', () => {
    const term = search.value.trim().toLowerCase()
    for (const [id, link] of sideLinks) {
      const page = pageById.get(id)
      const hay = `${page?.title} ${page?.sections.map((s) => s.title).join(' ')}`.toLowerCase()
      link.classList.toggle('sidebar__link--hidden', term !== '' && !hay.includes(term))
    }
  })

  const content = h('main', { class: 'content' })
  const toc = h('aside', { class: 'toc' })
  const scrim = h('div', { class: 'scrim', 'aria-hidden': 'true' })
  // Sampled by iOS 26 to tint the bottom toolbar the page colour while the drawer
  // is open (see .drawer-foot); removed from the layout on close.
  const drawerFoot = h('div', { class: 'drawer-foot', 'aria-hidden': 'true' })
  root.append(topbar, h('div', { class: 'layout' }, sidebar, content, toc), scrim, drawerFoot)

  // Mobile drawer -----------------------------------------------------------
  const closeDrawer = mountDrawer({ sidebar, scrim, menuBtn, search, tools, topbarInner, spacer })

  // Routing -----------------------------------------------------------------
  let teardown: Array<() => void> = []
  const route = (): void => {
    closeDrawer(false) // a navigation always dismisses the open menu
    const id = location.hash.replace(/^#\/?/, '')
    const page = pageById.get(id) ?? pages[0]
    if (page === undefined) return
    for (const fn of teardown) fn()
    teardown = []
    for (const [linkId, link] of sideLinks) link.classList.toggle('sidebar__link--active', linkId === page.id)
    renderPage(page, pages, content, toc, teardown)
    try {
      window.scrollTo({ top: 0 })
    } catch {
      // headless/jsdom: no scrolling available
    }
  }
  window.addEventListener('hashchange', route)
  route()
}

// --- mobile drawer ---------------------------------------------------------

// Wires the hamburger / scrim / Escape / focus-trap into a slide-in drawer and
// returns a close() for the router to call on navigation. The slide runs on animate().
function mountDrawer(refs: {
  sidebar: HTMLElement
  scrim: HTMLElement
  menuBtn: HTMLButtonElement
  search: HTMLInputElement
  tools: HTMLElement
  topbarInner: HTMLElement
  spacer: HTMLElement
}): (returnFocus?: boolean) => void {
  const { sidebar, scrim, menuBtn, search, tools, topbarInner, spacer } = refs
  const mql = window.matchMedia('(max-width: 820px)')
  let open = false

  // visibility:hidden keeps the closed drawer laid out, so this stays accurate
  // even before the first open; offsetWidth is a belt-and-suspenders fallback.
  const width = (): number => sidebar.getBoundingClientRect().width || sidebar.offsetWidth || 320
  const focusable = (): HTMLElement[] =>
    Array.from(
      sidebar.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'),
    ).filter((node) => node.offsetParent !== null)

  const openDrawer = (): void => {
    if (open || !mql.matches) return
    open = true
    document.body.classList.add('nav-open')
    menuBtn.setAttribute('aria-expanded', 'true')
    menuBtn.setAttribute('aria-label', 'Close navigation')
    menuBtn.innerHTML = ICON_CLOSE
    // Explicit [from, to]: a channel's first touch starts from x:0 and would skip
    // the slide. The --drawer-pad gutter swallows the underdamped overshoot.
    animate(sidebar, { x: [-width(), 0] }, { stiffness: 320, damping: 21 })
    animate(scrim, { opacity: [0, 1] }, { stiffness: 320, damping: 38 })
    // On touch, focus the panel, not the search box: focusing search pops the iOS
    // keyboard on open. A real keyboard (fine pointer) still lands on the box.
    if (window.matchMedia('(pointer: coarse)').matches) sidebar.focus({ preventScroll: true })
    else search.focus({ preventScroll: true })
  }

  const closeDrawer = (returnFocus = true): void => {
    if (!open) return
    open = false
    menuBtn.setAttribute('aria-expanded', 'false')
    menuBtn.setAttribute('aria-label', 'Open navigation')
    menuBtn.innerHTML = ICON_MENU
    // Close near-critically damped (no bounce); a loose rest threshold resolves
    // finished as soon as the panel is off-screen, lifting the scroll-lock.
    animate(scrim, { opacity: 0 }, { stiffness: 340, damping: 38 })
    void animate(sidebar, { x: -width() }, { stiffness: 340, damping: 36, restDelta: 1.5, restSpeed: 150 })
      .finished.then(() => {
        if (!open) document.body.classList.remove('nav-open') // hides via CSS once off-screen
      })
    // Return focus to the trigger; also rescue focus stranded on a drawer link
    // that a navigation is about to hide (returnFocus is false from route()).
    if (returnFocus || sidebar.contains(document.activeElement)) menuBtn.focus({ preventScroll: true })
  }

  // Relocate the badge+search between top bar (desktop) and drawer (mobile), and
  // hard-reset any drawer state/inline styles when returning to the desktop layout.
  const syncViewport = (): void => {
    if (mql.matches) {
      if (tools.parentElement !== sidebar) sidebar.prepend(tools)
    } else {
      open = false
      document.body.classList.remove('nav-open')
      menuBtn.setAttribute('aria-expanded', 'false')
      menuBtn.setAttribute('aria-label', 'Open navigation')
      menuBtn.innerHTML = ICON_MENU
      sidebar.style.transform = '' // drop the engine's leftover translateX
      scrim.style.opacity = ''
      if (tools.parentElement !== topbarInner) topbarInner.insertBefore(tools, spacer)
    }
  }

  menuBtn.addEventListener('click', () => (open ? closeDrawer() : openDrawer()))
  scrim.addEventListener('click', () => closeDrawer())
  sidebar.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeDrawer()
      return
    }
    if (event.key !== 'Tab') return
    const items = focusable()
    const first = items[0]
    const last = items[items.length - 1]
    if (first === undefined || last === undefined) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  })
  mql.addEventListener('change', syncViewport)
  syncViewport()

  return closeDrawer
}

function renderPage(page: Page, pages: Page[], content: HTMLElement, toc: HTMLElement, teardown: Array<() => void>): void {
  content.replaceChildren()
  // Functional breadcrumb: "Docs" -> landing page, the group -> its first page,
  // then the current page as the (non-link) leaf.
  const homeId = pages[0]?.id ?? page.id
  const groupFirstId = pages.find((candidate) => candidate.group === page.group)?.id ?? page.id
  const sep = (): HTMLElement => h('span', { class: 'breadcrumb__sep' }, '/')
  content.append(
    h('nav', { class: 'breadcrumb', 'aria-label': 'Breadcrumb' },
      h('a', { class: 'breadcrumb__link', href: `#/${homeId}` }, 'Docs'),
      sep(),
      h('a', { class: 'breadcrumb__link', href: `#/${groupFirstId}` }, page.group),
      sep(),
      h('span', { class: 'breadcrumb__current', 'aria-current': 'page' }, page.title),
    ),
    h('h1', { class: 'content__title' }, page.title),
  )
  if (page.blurb !== undefined) content.append(h('p', { class: 'content__lead', html: page.blurb }))

  for (const section of page.sections) content.append(renderCard(section, teardown))

  // Right "on this page"
  toc.replaceChildren(h('div', { class: 'toc__title' }, 'On this page'))
  const tocLinks = new Map<string, HTMLElement>()
  const setActive = (id: string): void => {
    for (const [linkId, link] of tocLinks) link.classList.toggle('toc__link--active', linkId === id)
  }
  for (const section of page.sections) {
    const link = h('div', {
      class: 'toc__link',
      onClick: () => {
        setActive(section.id) // instant feedback; do not wait for the scroll to settle
        document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' })
      },
    }, section.title)
    tocLinks.set(section.id, link)
    toc.append(link)
  }

  // Scroll-spy: the topmost section in the band wins, except at page bottom where
  // the last section can't reach it (so bottom-of-page wins, lighting the last item).
  const visible = new Set<string>()
  // Reading scrollHeight forces a synchronous reflow; the scroll handler fires a
  // burst during a rubber-band overscroll, so measuring it on every event thrashes
  // layout (worse the taller the page). It changes only on resize - measure there.
  let scrollable = 0
  const measure = (): void => {
    scrollable = document.documentElement.scrollHeight - window.innerHeight
  }
  measure()
  requestAnimationFrame(measure) // re-measure once after first layout (web fonts, async)
  const atBottom = (): boolean => scrollable > 4 && window.scrollY >= scrollable - 2 // only when the page truly scrolls
  const update = (): void => {
    if (atBottom()) {
      const last = page.sections[page.sections.length - 1]
      if (last !== undefined) setActive(last.id)
      return
    }
    const topmost = page.sections.find((section) => visible.has(section.id))
    if (topmost !== undefined) setActive(topmost.id)
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id)
        else visible.delete(entry.target.id)
      }
      update()
    },
    { rootMargin: '-80px 0px -70% 0px' },
  )
  for (const section of page.sections) {
    const node = document.getElementById(section.id)
    if (node !== null) observer.observe(node)
  }
  window.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', measure, { passive: true })
  teardown.push(() => {
    observer.disconnect()
    window.removeEventListener('scroll', update)
    window.removeEventListener('resize', measure)
  })
}

function renderCard(section: Section, teardown: Array<() => void>): HTMLElement {
  const stage = h('div', { class: 'demo__stage' })
  const controls = h('div', { class: 'demo__controls' })
  let cleanups: Array<() => void> = []

  const mount = (): void => {
    for (const fn of cleanups) fn()
    cleanups = []
    stage.replaceChildren()
    controls.replaceChildren()
    section.run({ stage, controls, onCleanup: (fn) => cleanups.push(fn) })
    if (!section.noReplay) controls.append(h('button', { class: 'btn btn--replay', onClick: mount }, 'Replay'))
  }
  // Page teardown runs whatever the current mount registered.
  teardown.push(() => {
    for (const fn of cleanups) fn()
  })

  const codeBlock = (source: string): HTMLElement =>
    h('pre', { class: 'code' }, h('code', { class: 'code__body', html: highlight(source) }))

  const card = h('section', { class: 'doc', id: section.id },
    h('div', { class: 'doc__head' }, h('span', { class: 'handle' }, h('i', { class: 'handle__node' })), h('h2', { class: 'doc__title' }, section.title)),
    h('p', { class: 'doc__tagline' }, section.tagline),
    h('div', { class: 'doc__prose', html: section.description }),
    h('div', { class: 'demo' },
      h('div', { class: 'demo__live' }, stage, controls),
      h('div', { class: 'demo__code' }, h('div', { class: 'demo__codebar' }, 'TypeScript'), codeBlock(section.code)),
    ),
  )
  if (section.api !== undefined) {
    card.append(h('details', { class: 'api' }, h('summary', { class: 'api__summary' }, 'API'), codeBlock(section.api)))
  }

  queueMicrotask(mount)
  return card
}
