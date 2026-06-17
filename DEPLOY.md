# Deploy

Two public sites come out of this one monorepo:

| Site | Source | Domain |
| --- | --- | --- |
| Landing | `apps/landing` | `underlyi.ng` (+ `www`) |
| Docs / demo | `apps/demo` | `docs.underlyi.ng` |

They are two separate Cloudflare Pages projects, both connected to this same
GitHub repo. Each builds only its own app (and that app's workspace
dependencies) with a pnpm filter, so a push to the production branch rebuilds
both independently.

## Cloudflare Pages - project 1: landing (underlyi.ng)

Workers and Pages -> Create -> Pages -> Connect to Git -> this repo.

- Production branch: `main`
- Framework preset: None
- Build command: `pnpm build:landing`
- Build output directory: `apps/landing/dist`
- Root directory: leave at the repo root (the pnpm workspace and lockfile must resolve)
- Environment variable: `NODE_VERSION` = `20`

After the first deploy: project -> Custom domains -> add `underlyi.ng` and
`www.underlyi.ng`. The zone is on Cloudflare, so the DNS records are created
automatically (apex via CNAME flattening).

## Cloudflare Pages - project 2: docs (docs.underlyi.ng)

Same repo, a second Pages project.

- Production branch: `main`
- Build command: `pnpm build:docs`
- Build output directory: `apps/demo/dist`
- Root directory: repo root
- Environment variable: `NODE_VERSION` = `20`
- Custom domain: add `docs.underlyi.ng` (the `docs` CNAME is created automatically)

## Notes

- pnpm is detected from `pnpm-lock.yaml` plus the `packageManager` field; no extra config.
- Both apps build with Vite base `/` (the docs sit at the root of their own
  subdomain, so there is no `/docs/` path rewrite). Nothing to change.
- The shared `brand/` folder is each app's Vite `publicDir`, so the wordmark,
  favicons and the Fraunces face are copied into every `dist`.
- Both sites are single page (no client-side routing), so no `_redirects` /
  SPA fallback is needed.
- Until `feat/landing` is merged, either merge first or point the landing
  project's production branch at the branch to preview it live.
