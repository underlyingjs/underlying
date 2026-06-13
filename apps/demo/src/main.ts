import './styles.scss'
import { renderShowcase, type Page } from './showcase'
import { gettingStarted, interruption, springs } from './sections/core'
import { colors, composite, keyframes, lengthsUnits } from './sections/value-model'
import { gestures, setRelease } from './sections/gestures'
import { composition } from './sections/composition'
import { reducedMotion } from './sections/a11y'
import { customTypes } from './sections/extend'

const pages: Page[] = [
  {
    id: 'getting-started',
    group: 'Quick start',
    title: 'Getting started',
    blurb: '<strong>underlying</strong> is a physics-first web animation engine. Springs drive the motion, every value is interruptible with its velocity conserved, and accessibility is respected by default. Each demo below is live - click, drag, replay.',
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
