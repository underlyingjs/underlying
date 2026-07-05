import { Directive, ElementRef, inject, input, type OnInit } from '@angular/core'
import {
  reveal,
  scramble,
  split,
  typewriter,
  type RevealOptions,
  type ScrambleOptions,
  type SplitOptions,
  type TypewriterOptions,
} from '@underlying/text'
import { primitiveBinder } from './internal'

/** Split the host's text into lines / words / chars, reverted on destroy. */
@Directive({ selector: '[uSplit]', standalone: true })
export class UnderlyingSplitDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly bind = primitiveBinder()
  readonly options = input<SplitOptions>({}, { alias: 'uSplit' })
  ngOnInit(): void {
    this.bind(
      () => split(this.host, this.options()),
      (handle) => handle.revert(),
    )
  }
}

/** Masked per-line / word / char reveal on the host's text. */
@Directive({ selector: '[uReveal]', standalone: true })
export class UnderlyingRevealDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly bind = primitiveBinder()
  readonly options = input<RevealOptions>({}, { alias: 'uReveal' })
  ngOnInit(): void {
    this.bind(
      () => reveal(this.host, this.options()),
      (handle) => handle.revert(),
    )
  }
}

/**
 * Typewriter effect. Bind the text via `[uTypewriter]` and tune with
 * `[uTypewriterOptions]`. The text is read once at init (a one-shot entrance);
 * changing the bound value does not re-type.
 */
@Directive({ selector: '[uTypewriter]', standalone: true })
export class UnderlyingTypewriterDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly bind = primitiveBinder()
  readonly text = input.required<string>({ alias: 'uTypewriter' })
  readonly options = input<TypewriterOptions>({}, { alias: 'uTypewriterOptions' })
  ngOnInit(): void {
    this.bind(
      () => typewriter(this.host, this.text(), this.options()),
      (handle) => handle.stop(),
    )
  }
}

/**
 * Scramble-in effect. Bind the text via `[uScramble]` and tune with
 * `[uScrambleOptions]`. The text is read once at init (a one-shot entrance);
 * changing the bound value does not re-run.
 */
@Directive({ selector: '[uScramble]', standalone: true })
export class UnderlyingScrambleDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly bind = primitiveBinder()
  readonly text = input.required<string>({ alias: 'uScramble' })
  readonly options = input<ScrambleOptions>({}, { alias: 'uScrambleOptions' })
  ngOnInit(): void {
    this.bind(
      () => scramble(this.host, this.text(), this.options()),
      (handle) => handle.stop(),
    )
  }
}
