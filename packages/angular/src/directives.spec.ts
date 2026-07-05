// Verifies the adapter contract: a directive attaches its primitive to the host on
// init and disposes it on destroy. Signal-input BINDING (e.g. [uDraggable]="opts")
// is validated by the AOT (ng-packagr) build - the vitest JIT env does not run the
// Angular compiler, so `input()` metadata is not reconstructed for template binding;
// these tests therefore exercise the directives with their default options.
import { Component, provideZonelessChangeDetection } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { UnderlyingAnimateDirective } from './animate.directive'
import { UnderlyingDraggableDirective } from './draggable.directive'
import { UnderlyingReorderDirective } from './flip.directive'
import { UnderlyingSplitDirective } from './text.directives'

afterEach(() => TestBed.resetTestingModule())

const mount = <T>(type: new () => T) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] })
  const fixture = TestBed.createComponent(type)
  fixture.detectChanges() // runs ngOnInit / the effect
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
