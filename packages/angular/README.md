# @underlying/angular

The Angular adapter for [underlying](https://github.com/underlyingjs/underlying) - standalone directives that bind `animate()`, gestures, text effects and FLIP to your elements, with automatic teardown on destroy.

No `dispose()` in `ngOnDestroy`, no `ElementRef` plumbing: add an attribute, bind options, done. Every directive cleans itself up through `DestroyRef` when the host is destroyed.

## Install

```sh
npm i @underlying/angular
```

Angular 19 or 20 (peer). The core packages (`@underlying/core`, `gestures`, `text`, `flip`) come along as dependencies.

## Use

Import the directives you need (they are standalone), or all of them at once:

```ts
import { Component, signal } from '@angular/core'
import { UNDERLYING_DIRECTIVES } from '@underlying/angular'

@Component({
  standalone: true,
  imports: [...UNDERLYING_DIRECTIVES],
  template: `
    <div uAnimate [uAnimate]="{ x: open() ? 200 : 0 }" [uAnimateOptions]="{ stiffness: 320 }"></div>
    <button uInteractive>Springy</button>
    <div uDraggable [uDraggable]="{ axis: 'x' }"></div>
    <div class="card" uTilt uMagnetic></div>
    <h1 uReveal [uReveal]="{ by: 'words' }">A masked, line-by-line reveal</h1>
    <ul uReorder [uReorder]="{ handle: '.grip' }">
      <li *ngFor="let item of items()"><span class="grip">⠿</span>{{ item }}</li>
    </ul>
  `,
})
export class Demo {
  readonly open = signal(false)
  readonly items = signal(['A', 'B', 'C'])
}
```

## Directives

| Directive | Wraps | Notes |
| --- | --- | --- |
| `uAnimate` | `animate()` | **Reactive** - re-springs when the bound targets signal changes. `[uAnimateOptions]` for spring config. |
| `uDraggable` | `draggable()` | Momentum-aware dragging. |
| `uTilt` | `tilt()` | 3D card tilt toward the pointer. |
| `uMagnetic` | `magnetic()` | Magnetic pull within a radius. |
| `uDepth` | `depth()` | Pointer-driven 2.5D parallax. |
| `uAmbient` | `ambient()` | Perpetual idle self-animation. |
| `uInteractive` | `interactive()` | Declarative hover / press states, keyboard-aware. |
| `uSplit` | `split()` | Split text into lines / words / chars. |
| `uReveal` | `reveal()` | Masked per-piece reveal. |
| `uTypewriter` | `typewriter()` | Bind the text via `[uTypewriter]`. |
| `uScramble` | `scramble()` | Bind the text via `[uScramble]`. |
| `uReorder` | `reorder()` | Drag-to-reorder the host's children. |

Options are read from the directive input at init; the underlying handle is disposed automatically on destroy. `uAnimate` is the reactive one - it tracks its targets signal and retargets the same live channels (interruptible, velocity conserved).

## License

MIT
