import './styles.scss'
import { renderShowcase, type Page } from './showcase'
import { customPhysics, gettingStarted, interruption, springs } from './sections/core'
import { colors, composite, keyframes, lengthsUnits } from './sections/value-model'
import { gestures, setRelease } from './sections/gestures'
import { composition } from './sections/composition'
import { bakedClip, momentumScrub, pauseResume, scrub, slowMo } from './sections/playback'
import { scrollParallax, scrollScrub, scrollSnap, scrollTo, scrollTrack, scrollTrigger } from './sections/scroll'
import { sequenceInterrupt, timelineChoreograph, timelineScroll } from './sections/timeline'
import { dragPlayground, flipShuffle } from './sections/drag-flip'
import { svgDraw, svgMorph, svgMotionPath } from './sections/svg'
import { textReveal, textScramble, textSplit, textTypewriter } from './sections/text'
import { flip3d, menuOrigin } from './sections/transform3d'
import { namedEases } from './sections/eases'
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
    blurb: 'No durations, no cubic-bezier guesswork. Tune stiffness and damping, and retarget at any time without a jump. Spring, decay, and tween are presets over one Simulation primitive you can extend.',
    sections: [springs, interruption, customPhysics],
  },
  {
    id: 'value-model',
    group: 'Fundamentals',
    title: 'Value model',
    blurb: 'Beyond the five transform/opacity channels, <code>animate()</code> drives any CSS property - lengths with unit conversion, colors, composite values, and keyframe arrays.',
    sections: [lengthsUnits, colors, composite, keyframes, flip3d, menuOrigin, namedEases],
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
    blurb: 'Scroll as a source, not an engine. <code>@underlying/scroll</code> owns the IntersectionObserver, the passive listener, and getBoundingClientRect, turns scroll into a normalized 0..1, and fans it onto the core seams: <code>scrub()</code> (locked or momentum), <code>parallax()</code>, <code>pin()</code>, <code>snap()</code>, and <code>trigger()</code>, plus a spring-driven <code>scrollTo()</code> and dev <code>markers()</code>, all on the one rAF loop. Each demo drives its own scroll container.',
    sections: [scrollScrub, scrollParallax, scrollTrigger, scrollTo, scrollSnap, scrollTrack],
  },
  {
    id: 'timeline',
    group: 'Guides',
    title: 'Timeline & sequence',
    blurb: 'Two ways to compose motion. A timeline is a score you can <em>scrub</em>: <code>@underlying/timeline</code> sequences with labels and relative positions, nests, and the master <em>is</em> a seekable handle - so <code>@underlying/scroll</code> scrubs a whole timeline. To stay seekable it records its physics, a spring baked into the exact trajectory a live one would draw. Its live twin, <code>sequence()</code> in core/playback, composes the same way but keeps every value <em>interruptible</em> - you cannot scrub it, but you can retarget it mid-flight with velocity conserved. Scrub or interrupt: pick per effect.',
    sections: [timelineChoreograph, sequenceInterrupt, timelineScroll],
  },
  {
    id: 'drag-flip',
    group: 'Guides',
    title: 'Drag & FLIP',
    blurb: '<code>@underlying/gestures</code> - drag and fling with the pointer\'s velocity handed straight into physics, plus FLIP layout transitions that spring to their new places and stay <em>interruptible</em>: mutate again mid-flight and each element retargets from its live velocity, never a restart.',
    sections: [dragPlayground, flipShuffle],
  },
  {
    id: 'svg',
    group: 'Guides',
    title: 'SVG path',
    blurb: '<code>@underlying/svg</code> animates SVG paths physics-first: <code>motionPath()</code> rides an element along a path, <code>draw()</code> draws a stroke on, and <code>morph()</code> turns one shape into another. The progress of each is a live value you can flick, interrupt or scrub - no baked path tweens.',
    sections: [svgMotionPath, svgDraw, svgMorph],
  },
  {
    id: 'text',
    group: 'Guides',
    title: 'Text',
    blurb: '<code>@underlying/text</code> splits text into chars, words and lines you can animate - without breaking accessibility: the screen reader reads it whole, copy/paste is intact, emoji stay whole. <code>reveal()</code> springs the pieces in; <code>scramble()</code> and <code>typewriter()</code> write content with the final text always the accessible name.',
    sections: [textSplit, textReveal, textScramble, textTypewriter],
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
