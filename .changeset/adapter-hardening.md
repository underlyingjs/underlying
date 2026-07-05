---
"@underlying/react": patch
"@underlying/vue": patch
"@underlying/angular": patch
---

Harden the framework adapters and keep the package family on a single core.

**SSR-safe Angular.** The standalone directives now create their primitives with
`NgZone.runOutsideAngular` - their animation frames and pointer listeners no longer
trigger change detection - and skip the work entirely off the browser, so they no
longer run during server-side rendering (Angular Universal).

**No first-paint flash in React.** The DOM-mutating hooks (`useSplit`, `useReveal`,
and the initial `useAnimate` positioning) now run in a layout effect, so the element
is in place before the browser paints, falling back to a passive effect during SSR.

**One shared core.** Inter-package dependencies are now caret ranges instead of exact
pins, so installing an adapter alongside a direct `@underlying/core` dependency
dedupes to a single core - one rAF loop, one style registry - instead of risking two.

Also: `useTypewriter` / `useScramble` (and the `uTypewriter` / `uScramble` directives)
now document that their text is read once on mount, a one-shot entrance; each adapter
ships a `LICENSE`, a `./package.json` export and a gzip size budget; and
`@underlying/angular` drops an unused `@underlying/scroll` dependency.
