// Verifies the adapter contract: a directive attaches its primitive to the host on
// init and disposes it on destroy. Signal-input BINDING (e.g. [uDraggable]="opts")
// is validated by the AOT (ng-packagr) build - the vitest JIT env does not run the
// Angular compiler, so `input()` metadata is not reconstructed for template binding;
// these tests therefore exercise the directives with their default options.
import { Component, PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { UnderlyingAnimateDirective } from './animate.directive'
import { UnderlyingDraggableDirective } from './draggable.directive'
import { UnderlyingReorderDirective } from './flip.directive'
import {
  UnderlyingAmbientDirective,
  UnderlyingDepthDirective,
  UnderlyingInteractiveDirective,
  UnderlyingMagneticDirective,
  UnderlyingTiltDirective,
} from './gestures.directives'
import { UnderlyingRevealDirective, UnderlyingSplitDirective } from './text.directives'

afterEach(() => TestBed.resetTestingModule())

const mount = <T>(type: new () => T) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] })
  const fixture = TestBed.createComponent(type)
  fixture.detectChanges() // runs ngOnInit / the effect
  return fixture
}

// Mount as if server-rendered: overriding PLATFORM_ID makes isPlatformBrowser()
// false, so primitiveBinder() (and the animate effect) must no-op - no DOM writes.
const mountServer = <T>(type: new () => T) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), { provide: PLATFORM_ID, useValue: 'server' }],
  })
  const fixture = TestBed.createComponent(type)
  fixture.detectChanges()
  return fixture
}

@Component({ standalone: true, imports: [UnderlyingDraggableDirective], template: `<div uDraggable></div>` })
class DraggableHost {}

describe('uDraggable', () => {
  it('makes the host draggable on init and restores it on destroy', () => {
    const fixture = mount(DraggableHost)
    const div = fixture.nativeElement.querySelector('div') as HTMLElement
    expect(div.style.touchAction).toBe('none') // draggable() drove the host
    fixture.destroy()
    expect(div.style.touchAction).not.toBe('none') // disposed -> restored
  })
})

@Component({
  standalone: true,
  imports: [UnderlyingReorderDirective],
  template: `<ul uReorder>
    <li>one</li>
    <li>two</li>
  </ul>`,
})
class ReorderHost {}

describe('uReorder', () => {
  it('wires reorder on the host list (children get touch-action none) and cleans up', () => {
    const fixture = mount(ReorderHost)
    const items = fixture.nativeElement.querySelectorAll('li') as NodeListOf<HTMLElement>
    expect(items[0]!.style.touchAction).toBe('none')
    fixture.destroy()
    expect(items[0]!.style.touchAction).not.toBe('none')
  })
})

@Component({ standalone: true, imports: [UnderlyingSplitDirective], template: `<p uSplit>hi there</p>` })
class SplitHost {}

describe('uSplit', () => {
  it('splits the host text into pieces and reverts on destroy', () => {
    const fixture = mount(SplitHost)
    const p = fixture.nativeElement.querySelector('p') as HTMLElement
    expect(p.querySelectorAll('span').length).toBeGreaterThan(0) // split wrapped the text
    fixture.destroy()
    expect(p.textContent).toBe('hi there') // reverted to the original
  })
})

@Component({ standalone: true, imports: [UnderlyingAnimateDirective], template: `<div uAnimate></div>` })
class AnimateHost {}

describe('uAnimate', () => {
  it('attaches its reactive effect and releases styles on destroy, without throwing', () => {
    expect(() => {
      const fixture = mount(AnimateHost)
      fixture.destroy()
    }).not.toThrow()
  })
})

// The pointer gestures bind a transform to the host synchronously on init
// (bindStyle writes the current values at bind time), so an inline `transform` is
// the observable proof the primitive drove the host. Disposal removes the
// listeners, which is not observable through the DOM, so we assert a clean destroy.

@Component({ standalone: true, imports: [UnderlyingTiltDirective], template: `<div uTilt></div>` })
class TiltHost {}

describe('uTilt', () => {
  it('drives a transform on the host on init and disposes cleanly on destroy', () => {
    const fixture = mount(TiltHost)
    const div = fixture.nativeElement.querySelector('div') as HTMLElement
    expect(div.style.transform).toContain('perspective')
    expect(() => fixture.destroy()).not.toThrow()
  })
})

@Component({ standalone: true, imports: [UnderlyingMagneticDirective], template: `<button uMagnetic></button>` })
class MagneticHost {}

describe('uMagnetic', () => {
  it('drives a transform on the host on init and disposes cleanly on destroy', () => {
    const fixture = mount(MagneticHost)
    const btn = fixture.nativeElement.querySelector('button') as HTMLElement
    expect(btn.style.transform).toContain('translate3d')
    expect(() => fixture.destroy()).not.toThrow()
  })
})

@Component({ standalone: true, imports: [UnderlyingDepthDirective], template: `<div uDepth></div>` })
class DepthHost {}

describe('uDepth', () => {
  it('drives a transform on the host on init and disposes cleanly on destroy', () => {
    const fixture = mount(DepthHost)
    const div = fixture.nativeElement.querySelector('div') as HTMLElement
    expect(div.style.transform).toContain('translate3d')
    expect(() => fixture.destroy()).not.toThrow()
  })
})

@Component({ standalone: true, imports: [UnderlyingAmbientDirective], template: `<div uAmbient></div>` })
class AmbientHost {}

describe('uAmbient', () => {
  it('self-animates a transform on the host on init and disposes cleanly on destroy', () => {
    const fixture = mount(AmbientHost)
    const div = fixture.nativeElement.querySelector('div') as HTMLElement
    expect(div.style.transform).not.toBe('') // breathe/drift bind the transform
    expect(() => fixture.destroy()).not.toThrow()
  })
})

@Component({ standalone: true, imports: [UnderlyingInteractiveDirective], template: `<div uInteractive></div>` })
class InteractiveHost {}

describe('uInteractive', () => {
  // With the default (empty) options no channel is bound, so there is no inline
  // style to observe (the JIT env can't bind the [uInteractive] hover/press input,
  // see the file header); we assert the init/destroy lifecycle is clean.
  it('attaches on init and disposes cleanly on destroy, without throwing', () => {
    expect(() => {
      const fixture = mount(InteractiveHost)
      fixture.destroy()
    }).not.toThrow()
  })
})

@Component({ standalone: true, imports: [UnderlyingRevealDirective], template: `<p uReveal>hi there</p>` })
class RevealHost {}

describe('uReveal', () => {
  it('splits the host text for the reveal on init and reverts on destroy', () => {
    const fixture = mount(RevealHost)
    const p = fixture.nativeElement.querySelector('p') as HTMLElement
    expect(p.querySelectorAll('span').length).toBeGreaterThan(0) // reveal split-wrapped the text
    fixture.destroy()
    expect(p.textContent).toBe('hi there') // reverted to the original
  })
})

// note: uTypewriter / uScramble take `input.required<string>()`. The JIT test env
// does not reconstruct input() metadata for template binding (NG0303), so the
// required text can't be supplied and mounting the directive with no value throws
// NG0950 in ngOnInit. Their behavior is exercised at the primitive level
// (@underlying/text) and validated for the adapter by the AOT ng-packagr build.

describe('SSR (non-browser platform)', () => {
  it('uSplit no-ops off the browser: leaves the host text unwrapped', () => {
    const fixture = mountServer(SplitHost)
    const p = fixture.nativeElement.querySelector('p') as HTMLElement
    expect(p.querySelectorAll('span').length).toBe(0) // primitiveBinder skipped the DOM write
    expect(p.textContent).toBe('hi there')
    fixture.destroy()
  })

  it('uDraggable no-ops off the browser: leaves the host untouched', () => {
    const fixture = mountServer(DraggableHost)
    const div = fixture.nativeElement.querySelector('div') as HTMLElement
    expect(div.style.touchAction).not.toBe('none') // never bound off the browser
    fixture.destroy()
  })

  it('uAnimate no-ops off the browser: writes no inline transform', () => {
    const fixture = mountServer(AnimateHost)
    const div = fixture.nativeElement.querySelector('div') as HTMLElement
    expect(div.style.transform).toBe('') // the guarded effect never runs animate()
    fixture.destroy()
  })
})
