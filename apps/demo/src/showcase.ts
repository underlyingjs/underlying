// GSAP-style docs engine: a sticky top bar, a grouped left sidebar, a routed
// content column (one "page" at a time, hash-routed), and a right "on this page"
// panel with scroll-spy. Pages are groups of feature Sections; each Section is a
// live demo with prose, code, and an API block.
//
// On narrow viewports (<= 820px) the sidebar becomes a slide-in drawer driven by
// the very engine these docs document - dogfooding animate() for the one piece of
// interactive chrome the site owns.

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

// The "U" emblem from the brand guide (charte v2.0), for navbar / small sizes.
const EMBLEM_U =
  'M 1214.87 637.433 C 1262.04 635.401 1366.89 638.67 1373.21 702.576 C 1376.1 731.731 1355.17 750.501 1342.71 774.051 C 1334.95 788.732 1331.02 806.585 1328.25 822.896 C 1307.05 978.392 1361.27 1160.46 1248.23 1291.09 C 1196.72 1350.14 1123.46 1375.07 1047.62 1378.72 C 924.516 1385.48 779.558 1343.04 743.105 1209.48 C 713.397 1100.63 733.907 980.808 728.938 868.751 C 728.618 842.303 723.309 811.051 709.363 788.273 C 694.826 764.529 678.108 755.475 675.499 724.463 C 674.109 707.943 678.965 691.557 689.898 678.954 C 717.251 647.425 770.578 641.331 809.865 638.788 C 858.96 635.609 952.523 635.131 990.7 669.278 C 1004.81 681.896 1010.95 699.238 1008.95 717.931 C 1005.86 746.766 980.86 766.103 970.495 793.939 C 952.947 841.069 954.741 967.044 957.725 1020.67 C 959.779 1057.59 963.042 1105.9 992.707 1132.01 C 1008.73 1146.11 1030.08 1150.65 1050.98 1149.14 C 1069.4 1147.82 1086.63 1140.28 1098.8 1126.15 C 1111 1111.98 1116.88 1093.56 1120.57 1075.53 C 1130.05 1029.29 1133.87 849.053 1119.87 803.721 C 1110.41 773.116 1078.68 755.945 1076.53 722.611 C 1075.43 706.176 1081.03 689.996 1092.07 677.77 C 1120.12 646.454 1175.19 639.422 1214.87 637.433 z'

const ICON_MENU =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 6.5h18M3 12h18M3 17.5h18"/></svg>'
const ICON_CLOSE =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5.5 5.5l13 13M18.5 5.5l-13 13"/></svg>'
const ICON_GITHUB =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.16-.02-2.1-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z"/></svg>'

export function renderShowcase(pages: Page[], root: HTMLElement): void {
  const pageById = new Map(pages.map((page) => [page.id, page]))

  // Top bar -----------------------------------------------------------------
  // The hamburger only shows < 820px (CSS). The version badge + search live in
  // `tools`, a display:contents wrapper on desktop so they behave as direct
  // top-bar flex children; on mobile the whole wrapper is relocated into the
  // drawer (see syncViewport), which is why both share one container.
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
      html: `<svg class="brand__mark" viewBox="0 0 2048 2048" aria-hidden="true"><path fill="#1c3426" d="${EMBLEM_U}"/></svg><span class="brand__word">underlying<small class="brand__sub">docs</small></span>`,
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
  const sidebar = h('aside', { class: 'sidebar', id: 'site-nav' })
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
  root.append(topbar, h('div', { class: 'layout' }, sidebar, content, toc), scrim)

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
// returns a `close()` the router can call on navigation. The slide itself is run
// by animate() (springs, reduced-motion-aware) - the docs animating themselves.
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
    // Explicit `[from, to]` keyframe: a channel's first touch otherwise starts
    // from its CSS-neutral value (x: 0), which would skip the slide entirely.
    // Underdamped (zeta ~= 0.59) so the panel overshoots x:0 with a real spring
    // bounce - the --drawer-pad gutter swallows that overshoot, so it never
    // exposes a sliver of scrim at the screen edge. The scrim itself fades on a
    // near-critical spring (no flicker).
    animate(sidebar, { x: [-width(), 0] }, { stiffness: 320, damping: 21 })
    animate(scrim, { opacity: [0, 1] }, { stiffness: 320, damping: 38 })
    search.focus({ preventScroll: true })
  }

  const closeDrawer = (returnFocus = true): void => {
    if (!open) return
    open = false
    menuBtn.setAttribute('aria-expanded', 'false')
    menuBtn.setAttribute('aria-label', 'Open navigation')
    menuBtn.innerHTML = ICON_MENU
    // Close near-critically damped (bounce-free), with a loose rest threshold so
    // `finished` resolves the moment the panel is ~off-screen instead of chasing
    // the last sub-pixel - the scroll-lock (body.nav-open) lifts promptly.
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

  // Scroll-spy. The active link is the topmost section currently inside the
  // upper band - EXCEPT at the very bottom of the page, where the last section
  // can never reach that band, so it would otherwise never light up (the
  // off-by-one the short last section showed). Bottom-of-page wins.
  const visible = new Set<string>()
  const atBottom = (): boolean => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight
    return scrollable > 4 && window.scrollY >= scrollable - 2 // only when the page truly scrolls
  }
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
  teardown.push(() => {
    observer.disconnect()
    window.removeEventListener('scroll', update)
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
