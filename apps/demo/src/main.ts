import './styles.scss'
import { renderShowcase, type Page } from './showcase'
import { gettingStarted, interruption, springs } from './sections/core'
import { colors, composite, keyframes, lengthsUnits } from './sections/value-model'
import { gestures, setRelease } from './sections/gestures'
import { composition } from './sections/composition'
import { bakedClip, momentumScrub, pauseResume, scrub, slowMo } from './sections/playback'
import { scrollParallax, scrollScrub, scrollSnap, scrollTrack, scrollTrigger } from './sections/scroll'
import { timelineChoreograph, timelineScroll } from './sections/timeline'
import { reducedMotion } from './sections/a11y'
import { customTypes } from './sections/extend'

const pages: Page[] = [
  {
    id: 'getting-started',
    group: 'Quick start',
    title: 'Getting started',
    blurb: '<strong>underlying</strong> is a physics-first web animation engine: springs and inertia generate the motion, not eased curves. Single values stay live and interruptible, velocity conserved - gestures, momentum, retargets. Timelines you can scrub record that same physics so it stays seekable. Accessibility is respected by default. Each demo below is interactive - click, drag, scrub.',
    sections: [gettingStarted],
  },
  {
    id: 'core',
    group: 'Fundamentals',
    title: 'Core concepts',
    blurb: 'No durations, no cubic-bezier guesswork. Tune stiffness and damping, and retarget at any time without a jump.',
    sections: [springs, interruption],
  },
  {
    id: 'value-model',
    group: 'Fundamentals',
    title: 'Value model',
    blurb: 'Beyond the five transform/opacity channels, <code>animate()</code> drives any CSS property - lengths with unit conversion, colors, composite values, and keyframe arrays.',
    sections: [lengthsUnits, colors, composite, keyframes],
  },
  {
    id: 'gestures',
    group: 'Guides',
    title: 'Gestures',
    blurb: 'Velocity is a first-class citizen, so handing a gesture off into a spring or an inertial glide is a single argument.',
    sections: [gestures, setRelease],
  },
  {
    id: 'composition',
    group: 'Guides',
    title: 'Composition',
    blurb: 'Build cascades and ordered chains that batch into the one rAF loop.',
    sections: [composition],
  },
  {
    id: 'playback',
    group: 'Guides',
    title: 'Playback',
    blurb: 'Springs are live, tweens are seekable. The opt-in <code>@underlying/core/playback</code> entry adds pause, timeScale, reverse, and seek, a <code>bake()</code> bridge that turns a spring into a scrubbable clip, and <code>follow()</code> for momentum scrub.',
    sections: [pauseResume, slowMo, scrub, bakedClip, momentumScrub],
  },
  {
    id: 'scroll',
    group: 'Guides',
    title: 'Scroll',
    blurb: 'Scroll as a source, not an engine. <code>@underlying/scroll</code> owns the IntersectionObserver, the passive listener, and getBoundingClientRect, turns scroll into a normalized 0..1, and fans it onto the core seams: <code>scrub()</code> (locked or momentum), <code>parallax()</code>, <code>pin()</code>, <code>snap()</code>, and <code>trigger()</code>, all on the one rAF loop. Each demo drives its own scroll container.',
    sections: [scrollScrub, scrollParallax, scrollTrigger, scrollSnap, scrollTrack],
  },
  {
    id: 'timeline',
    group: 'Guides',
    title: 'Timeline',
    blurb: 'A timeline is a score you can scrub. <code>@underlying/timeline</code> sequences motion with labels and relative positions, nests, and the master <em>is</em> a seekable handle - so <code>@underlying/scroll</code> scrubs a whole timeline. To stay seekable it records its physics: a spring is baked into the exact trajectory a live one would draw, overshoot included, not an eased curve. Composed motion is physics-shaped but recorded; live, interruptible physics lives in core and momentum scrub.',
    sections: [timelineChoreograph, timelineScroll],
  },
  {
    id: 'accessibility',
    group: 'Guides',
    title: 'Accessibility',
    blurb: 'prefers-reduced-motion is honored with zero configuration, with skip / fade / allow strategies and an app-level override.',
    sections: [reducedMotion],
  },
  {
    id: 'extending',
    group: 'Reference',
    title: 'Extending',
    blurb: 'The value-type registry is the open extension point for the package family and your own app code.',
    sections: [customTypes],
  },
]

const app = document.getElementById('app')
if (app !== null) renderShowcase(pages, app)
