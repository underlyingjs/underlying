# underlying

Physics-first motion library for the web. Interruptible by design, accessible by default, framework-agnostic core with first-class adapters - Angular first.

| Package | Description | Status |
| --- | --- | --- |
| [`@underlying/core`](packages/core) | Physics engine: scheduler, animatable values, springs/inertia/decay, composition, a11y, WAAPI delegation | beta |
| `@underlying/angular` | Service, directives, signals integration | planned |
| `@underlying/scroll` | Scrub, pin, parallax, snap - scroll as a source driving animatables | planned |
| `@underlying/text` | Accessible text splitting, scramble, typewriter | planned |

## Development

```sh
pnpm install
pnpm test        # Vitest, TDD
pnpm typecheck   # strict TypeScript
pnpm build       # ESM + CJS + types
pnpm size        # gzip budget gate (< 10 kB for core)
pnpm demo        # interactive playground
```

## License

MIT © Erwan Soubeyrand
