import { Directive, DestroyRef, ElementRef, inject, input, type OnInit } from '@angular/core'
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

/** Split the host's text into lines / words / chars, reverted on destroy. */
@Directive({ selector: '[uSplit]', standalone: true })
export class UnderlyingSplitDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly destroyRef = inject(DestroyRef)
  readonly options = input<SplitOptions>({}, { alias: 'uSplit' })
  ngOnInit(): void {
    const handle = split(this.host, this.options())
    this.destroyRef.onDestroy(() => handle.revert())
  }
}

/** Masked per-line / word / char reveal on the host's text. */
@Directive({ selector: '[uReveal]', standalone: true })
export class UnderlyingRevealDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly destroyRef = inject(DestroyRef)
  readonly options = input<RevealOptions>({}, { alias: 'uReveal' })
  ngOnInit(): void {
    const handle = reveal(this.host, this.options())
    this.destroyRef.onDestroy(() => handle.revert())
  }
}

/** Typewriter effect. Bind the text via `[uTypewriter]` and tune with `[uTypewriterOptions]`. */
@Directive({ selector: '[uTypewriter]', standalone: true })
export class UnderlyingTypewriterDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly destroyRef = inject(DestroyRef)
  readonly text = input.required<string>({ alias: 'uTypewriter' })
  readonly options = input<TypewriterOptions>({}, { alias: 'uTypewriterOptions' })
  ngOnInit(): void {
    const handle = typewriter(this.host, this.text(), this.options())
    this.destroyRef.onDestroy(() => handle.stop())
  }
}

/** Scramble-in effect. Bind the text via `[uScramble]` and tune with `[uScrambleOptions]`. */
@Directive({ selector: '[uScramble]', standalone: true })
export class UnderlyingScrambleDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly destroyRef = inject(DestroyRef)
  readonly text = input.required<string>({ alias: 'uScramble' })
  readonly options = input<ScrambleOptions>({}, { alias: 'uScrambleOptions' })
  ngOnInit(): void {
    const handle = scramble(this.host, this.text(), this.options())
    this.destroyRef.onDestroy(() => handle.stop())
  }
}
