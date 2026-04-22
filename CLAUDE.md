# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Vite (port 5173) + Fastify (port 3000) concurrently
pnpm build        # vite build → dist/web/ && tsup → dist/server/
pnpm preview      # Run production build: node dist/server/index.js
pnpm test         # vitest (all tests)
pnpm test -- --run src/server/services/__tests__/cloudflare-setup.test.ts  # Single test file
pnpm test:e2e     # Playwright e2e tests (starts its own server on port 3001)
pnpm test:e2e:ui  # Playwright e2e tests with interactive UI
pnpm lint         # eslint src/
pnpm db:generate  # drizzle-kit generate (creates SQL migration from schema changes)
pnpm db:migrate   # drizzle-kit migrate (applies pending migrations)
pnpm db:reset     # delete local DB, regenerate and re-migrate (dev only)
```

Package manager is **pnpm**. Do not use npm or yarn.

## Architecture

### Three-zone source layout

```
src/
  server/   # Fastify Node.js backend (ESM, TypeScript)
  web/      # React 18 SPA (Vite)
  shared/   # Shared types/schemas imported by both sides via @shared/* alias
```

`@shared/*` resolves to `src/shared/` in tsconfig, vite.config, vitest.config, and tsup.config. When building, tsup bundles `@shared` into the server output (`noExternal: [/^@shared/]`).

### Server

**Entry point** — `src/server/index.ts` registers all Fastify plugins, decorates the app with `providerRegistry` and `db`, applies JWT auth preHandler to all routes except auth, registers route plugins under `/api/*`, and wires the WebSocket handler at `/ws`. In production it also serves the Vite-built SPA with a catch-all fallback.

**Database** — Drizzle ORM over libSQL (local SQLite file). Schema in `src/server/db/schema.ts` (six tables: `users`, `settings`, `exposure_providers`, `projects`, `container_stats`, `container_updates`). Call `getDatabase()` anywhere server-side to get the singleton. `DATABASE_PATH` env var (default `./data/homelabman.db`). When changing the schema, run `db:generate` then `db:migrate`.

**Auth** — HttpOnly JWT cookie (`token`). `authenticate` preHandler in `src/server/middleware/auth.middleware.ts` calls `request.jwtVerify()`. All API routes except `/api/auth/*` require it.

**WebSocket** — `src/server/websocket/stats.handler.ts`. Clients send `{type: 'subscribe'|'unsubscribe', projectId}` messages. Used for real-time deploy progress events and stats.

### Exposure Provider System

The provider system is the core extensibility mechanism:

1. **Interface** (`src/shared/exposure/provider.interface.ts`) — `ExposureProvider` contract. Optional methods: `listDomains()`, `checkSetup()`, `getComposeTemplate()`.
2. **BaseProvider** (`src/server/services/exposure/providers/base.provider.ts`) — Abstract class; stores `this.config` after `initialize()`.
3. **Registry** (`src/server/services/exposure/provider-registry.ts`) — `ExposureProviderRegistry` keyed by `provider.type`, decorated onto Fastify as `app.providerRegistry`. Providers registered at startup in `index.ts`.
4. **ExposureService** (`src/server/services/exposure/exposure.service.ts`) — Loads provider config from DB, calls `initialize(config)`, then delegates to provider methods.
5. **Concrete providers**: `CaddyProvider` (Caddy Admin API, routes keyed `homelabman-{projectId}`) and `CloudflareProvider` (Cloudflare Tunnel REST API, routes keyed by domain).

To add a new provider: implement `ExposureProvider` extending `BaseProvider`, register in `index.ts`.

### Adopt Stacks

`POST /api/projects/adopt` detects unmanaged Docker Compose stacks running on the host (containers with `com.docker.compose.project` label but no `homelabman.managed` label) and imports them as projects. `GET /api/projects/adoptable` returns the current list. The adopt service (`src/server/services/adopt.service.ts`) handles slug conflict detection and restores metadata from homelabman Docker labels (`homelabman.logo_url`, etc.) if present.

### Frontend

**API client** (`src/web/lib/api.ts`) — Thin `fetch` wrapper. Requests go to `/api` (Vite proxies to `:3000` in dev). Cookie-based auth with `credentials: 'include'`. Errors throw `ApiError(status, message)`. Methods: `api.get/post/put/delete<T>()`.

**Data fetching** — TanStack Query v5 wraps all `api.*` calls in hooks (`src/web/hooks/`). Common query keys: `['projects']`, `['projects', id]`, `['projects', 'adoptable']`, `['templates']`, `['templates', id]`, `['updates', projectId]`, `['stats', projectId, range]`, `['uptime', projectId]`, `['auth', 'status']`. QueryClient: `retry: 1`, `refetchOnWindowFocus: false`.

**Routing** — React Router v6, `BrowserRouter`. `ProtectedRoute` in `App.tsx` redirects unauthenticated users to `/login` or `/onboarding` based on `useAuthStatus`. All management pages are nested under the protected route.

**Forms** — react-hook-form with `@hookform/resolvers/zod`. Zod schemas from `src/shared/schemas.ts` serve as both server-side validation and client-side form validation.

### Build

- **Frontend**: Vite, output to `dist/web/`
- **Backend**: tsup (ESM, node24 target), output to `dist/server/`
- **Docker**: Two-stage build (node:20-alpine). Requires `/var/run/docker.sock` mount and `JWT_SECRET` env var.

## Key Conventions

- All route files export an async function `xxxRoutes(app: FastifyInstance)` registered as a Fastify plugin.
- `any` is intentionally allowed (`@typescript-eslint/no-explicit-any` is off).
- Unused variables prefixed with `_` are ignored by ESint.
- Tests use vitest with `globals: true` in Node environment. `vi.stubGlobal` / `vi.unstubAllGlobals` is the pattern for mocking `fetch` in unit tests.
- **Casing convention**: SQL column names use `snake_case` (Drizzle/SQLite standard). All JavaScript identifiers and JSON blobs stored in the DB (e.g. provider `configuration`, project `exposureConfig`) use `camelCase`. Never store snake_case keys inside JSON columns.
