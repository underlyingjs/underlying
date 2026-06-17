# Deploy

Two public sites come out of this one monorepo:

| Site | Source | Domain |
| --- | --- | --- |
| Landing | `apps/landing` | `underlyi.ng` (+ `www`) |
| Docs / demo | `apps/demo` | `docs.underlyi.ng` |

## Current state

There is already ONE Cloudflare Pages project, production branch `main`, that
builds the docs (`apps/demo`) and serves them at `underlyi.ng`.

The end state just moves the docs to a subdomain and gives the apex to the
landing. The apex domain never moves between projects: we repoint the existing
project to build the landing, and add a second project for the docs.

## Do this AT MERGE, not before

The landing must be on `main` first. Changing the existing project's build to
the landing BEFORE the landing is on `main` would fail the build and take the
live docs down. So until merge, review the landing locally with `pnpm landing`
(http://localhost:4000); leave Cloudflare untouched.

When `feat/landing` is merged to `main`:

1. Existing project (the one on `underlyi.ng`): Settings -> Builds & deployments
   -> change
   - Build command: `pnpm build:docs` -> `pnpm build:landing`
   - Build output directory: `apps/demo/dist` -> `apps/landing/dist`
   then redeploy `main`. `underlyi.ng` now serves the landing.

2. New project for the docs:
   - Connect the same repo, production branch `main`
   - Framework preset: None (so the build fields are editable)
   - Build command: `pnpm build:docs`
   - Build output directory: `apps/demo/dist`
   - Custom domain: `docs.underlyi.ng` (the CNAME is created automatically, the
     zone is already on Cloudflare)

Common settings for both: root directory left empty (the pnpm workspace must
resolve from the repo root), and `NODE_VERSION` = `20`. pnpm is auto-detected
from `pnpm-lock.yaml` plus the `packageManager` field.

## Notes

- Both apps build with Vite base `/` (the docs sit at the root of their own
  subdomain, no `/docs/` path rewrite). Nothing to change.
- The shared `brand/` folder is each app's Vite `publicDir`, so the wordmark,
  favicons and the Fraunces face land in every `dist`.
- Both sites are single page (no client-side routing), so no `_redirects` is needed.
- Optional, before merge: for a shareable cloud preview of the landing, create a
  throwaway extra Pages project (production `main`, `pnpm build:landing`) and use
  the per-branch preview URL it builds for `feat/landing`. Not required - local is
  enough.
