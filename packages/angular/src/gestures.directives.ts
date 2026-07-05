import { Directive, ElementRef, inject, input, type OnInit } from '@angular/core'
import {
  ambient,
  depth,
  interactive,
  magnetic,
  tilt,
  type AmbientOptions,
  type DepthOptions,
  type InteractiveOptions,
  type MagneticOptions,
  type TiltOptions,
} from '@underlying/gestures'
import { primitiveBinder } from './internal'

// Input signals hold their value only AFTER the first binding, so the primitive is
// created in ngOnInit (not the constructor, where inputs still read their default).
// primitiveBinder() runs in the field initializer (an injection context) and returns
// a binder that creates the primitive outside the Angular zone, skipping SSR.

/** 3D card tilt toward the pointer. `<div uTilt [uTilt]="{ max: 12 }"></div>` */
@Directive({ selector: '[uTilt]', standalone: true })
export class UnderlyingTiltDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly bind = primitiveBinder()
  readonly options = input<TiltOptions>({}, { alias: 'uTilt' })
  ngOnInit(): void {
    this.bind(
      () => tilt(this.host, this.options()),
      (handle) => handle.dispose(),
    )
  }
}

/** Magnetic pull toward the pointer within a radius. */
@Directive({ selector: '[uMagnetic]', standalone: true })
export class UnderlyingMagneticDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly bind = primitiveBinder()
  readonly options = input<MagneticOptions>({}, { alias: 'uMagnetic' })
  ngOnInit(): void {
    this.bind(
      () => magnetic(this.host, this.options()),
      (handle) => handle.dispose(),
    )
  }
}

/** Pointer-driven 2.5D depth parallax. */
@Directive({ selector: '[uDepth]', standalone: true })
export class UnderlyingDepthDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly bind = primitiveBinder()
  readonly options = input<DepthOptions>({}, { alias: 'uDepth' })
  ngOnInit(): void {
    this.bind(
      () => depth(this.host, this.options()),
      (handle) => handle.dispose(),
    )
  }
}

/** Perpetual idle / ambient self-animation (breathe / drift / bob / wander). */
@Directive({ selector: '[uAmbient]', standalone: true })
export class UnderlyingAmbientDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly bind = primitiveBinder()
  readonly options = input<AmbientOptions>({}, { alias: 'uAmbient' })
  ngOnInit(): void {
    this.bind(
      () => ambient(this.host, this.options()),
      (handle) => handle.dispose(),
    )
  }
}

/** Declarative hover / press state (springy scale / lift / etc.), keyboard-aware. */
@Directive({ selector: '[uInteractive]', standalone: true })
export class UnderlyingInteractiveDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly bind = primitiveBinder()
  readonly options = input<InteractiveOptions>({}, { alias: 'uInteractive' })
  ngOnInit(): void {
    this.bind(
      () => interactive(this.host, this.options()),
      (handle) => handle.dispose(),
    )
  }
}
