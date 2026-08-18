# AGENTS.md

## Working approach

- Define the requested outcome and an observable completion check before editing. Inspect relevant code, tests, configuration, and working-tree state first.
- Surface assumptions that affect behavior. Resolve low-risk ambiguity with the simplest reasonable interpretation; ask when a wrong choice would be costly or hard to reverse.
- Implement only the requested behavior. Reuse established patterns, avoid single-use abstractions and speculative flexibility, and keep every changed line traceable to the task.
- Preserve unrelated user changes. Do not refactor, reformat, rename, or remove pre-existing code unless the task requires it.
- Turn behavior changes into focused checks. Report what ran, what failed, and what was not run; do not infer executable correctness from inspection alone.

## Product and stack

- Saijai Phareab is a Thai-first, mobile-first laundry storefront and operations system: public pricing/packages, customer/member order tracking, employee/admin POS and management, payments/documents, notifications, and LINE-first login/communication.
- It is one Nuxt 4 full-stack application, not separate frontend/backend packages. Current direct versions are Nuxt `^4.3.1`, Vue `^3.5.29`, Nuxt UI `^4.5.1`, Tailwind CSS `^4.2.1`, Better Auth `^1.5.3`, Prisma `^7.4.2`, PostgreSQL, Zod `^4.3.6`, and Vitest `^4.1.7`.
- Important integrations are LINE LIFF and Messaging API, Cloudinary image storage, Resend email, Puppeteer/Sharp document rendering, and WebUSB/Bluetooth thermal printing.
- Use `pnpm` and the committed `pnpm-lock.yaml`; do not create npm or Yarn lockfiles.

## Repository map

- `app/app.vue`: minimal Nuxt application shell.
- `app/pages/`: file-based public, `auth`, `me`, `admin`, and print pages. Access-controlled pages declare layouts and route middleware with `definePageMeta`.
- `app/layouts/`, `app/components/`: default, user, admin, and print shells plus Nuxt UI-based UI. Preserve Thai copy, mobile states, loading/empty/error states, and the existing friendly tone.
- `app/composables/`: reusable client data/state access. Follow existing `$fetch`, `useState`, and `useNotify()` patterns rather than duplicating API shapes or using `alert()`.
- `app/plugins/liff-init.client.ts`, `app/composables/useLiffAuth.ts`, `app/middleware/auth.global.ts`: LIFF launch detection, SDK initialization, token-to-session exchange, safe return paths, and global session/navigation handling. Keep auto-login orchestration centralized in the global middleware rather than adding page-level callers.
- `app/middleware/role-*`: client navigation guards. These improve UX but are not server-side authorization.
- `app/utils/auth.ts`: server-side Better Auth configuration despite its location under `app/`; `app/utils/auth-client.ts` is the browser client.
- `server/api/`: Nitro file-based APIs grouped into `public`, `auth`, `me`, `admin`, and `line`. HTTP methods come from filename suffixes such as `.get.ts`, `.post.ts`, `.put.ts`, `.patch.ts`, and `.delete.ts`.
- `server/middleware/auth-session.ts`: hydrates `event.context.user`, refreshes role/active/deleted state from the database, revokes deleted sessions, and applies centralized prefix policies to admin route families.
- `server/utils/`: Prisma singleton, authorization helpers, state transitions, numbering, notifications, integrations, document rendering, and other server domain logic.
- `server/tasks/`: Nitro tasks. `notify:expiring-packages` is scheduled in `nuxt.config.ts` for 02:00 UTC / 09:00 Asia/Bangkok.
- `shared/types/`, `shared/config/`, `shared/utils/`: contracts, label/status configuration, and utilities shared by client and server. Prefer these over duplicate local definitions.
- `prisma/schema.prisma`: PostgreSQL schema; `prisma/migrations/`: migration history; `prisma/seed.ts`: normal catalog/package seed; `prisma/seed-full.ts`: larger development/demo dataset.
- `tests/server/`, `tests/shared/`: Node-environment Vitest coverage for domain transitions and shared utilities.
- `public/` contains static web assets.

## Architecture and conventions

### Frontend

- Nuxt auto-imports are standard. Use established `@`/`~` app aliases and `~~`/`@@` root aliases instead of fragile relative paths.
- Nuxt UI is the component system; global UI defaults are in `app/app.config.ts`, global CSS in `app/assets/css/main.css`, and shared admin presentation constants in `shared/config/adminUi.ts`.
- Put reusable remote data/state in composables. Keep API contracts in `shared/types/` when used across boundaries, and convert server values to JSON-safe shapes before they reach pages.
- Public pages use the default layout, `/me/**` uses the user layout plus `role-user` (and `role-member` where entitlement is required), and `/admin/**` uses the admin layout with employee/admin middleware as appropriate.
- Keep user-facing copy Thai unless the surrounding surface is intentionally English. Business dates and reports use Asia/Bangkok semantics.

### APIs and authorization

- Treat all request bodies, route params, query values, uploads, and webhook payloads as untrusted. Reuse the existing Zod plus `readValidatedBody`/`getValidatedQuery` pattern where practical; some older handlers still validate manually, so do not copy weaker validation merely for consistency.
- Use `requireUser`, `requireRole`, `requireMember`, and `hasActiveMemberPackage` from `server/utils/auth.ts`. Do not implement ad hoc session or role checks.
- `server/middleware/auth-session.ts` is the source of truth for the listed centralized `/api/admin` route-family policies. Add or update a policy when introducing a protected admin route family; handlers should still enforce their own required role as defense in depth.
- Every `/api/me/**` handler must call `requireUser` and constrain records by the authenticated user's ID. Never accept ownership from a client-supplied user ID.
- Member status is entitlement-derived, not a fourth database role. `USER`, `EMPLOYEE`, and `ADMIN` are schema roles; a member has an active, non-deleted entitlement within its start/end dates. Employee/admin access to member UI is a client-side convenience and must not weaken API ownership.
- Deleted users have sessions revoked; inactive employees/admins are blocked from admin paths. Preserve these semantics when changing auth or session code.
- Verify LINE webhooks with the raw body and `x-line-signature` before parsing or acting. Do not log provider tokens, session cookies, private customer data, or raw secrets.
- Convert expected operational failures to appropriate H3 errors; do not return internal exceptions or provider credentials to clients.

### Database and domain logic

- Runtime Prisma access goes through the singleton in `server/utils/prisma.ts`, using `PrismaPg` and `DATABASE_URL`. Prisma CLI configuration in `prisma.config.ts` uses `DIRECT_URL` for migrations.
- The generated Prisma client lives in `app/generated/prisma/`. Regenerate it; never edit generated files by hand.
- Most business records are soft-deleted. Include `deletedAt: null` in normal reads and relationship filters unless the feature explicitly handles deleted data.
- Preserve service-order and payment state machines in `server/utils/serviceOrderStatusTransition.ts` and `server/utils/paymentStateTransition.ts`. Update focused transition tests when behavior changes.
- Keep related order, entitlement credit/add-on usage, payment, receipt/quotation numbering, audit log, and status mutations atomic with a Prisma transaction.
- Prisma `Decimal` is not an API contract. Convert it to a JSON-safe application value using the local boundary pattern.
- Preserve singleton setting records and system/walk-in users. Review foreign keys, indexes, nullability, deletion behavior, and existing rows before changing schema behavior.
- For schema changes, update `prisma/schema.prisma`, add a new migration, and run Prisma generation. Never edit an already-applied migration.
- Migration history currently contains overlapping index operations between `20260519000000_db_audit_fixes` and `20260522000000_reconcile_schema`; validate the full chain on a disposable database before relying on a fresh migration replay.

## Environment and external services

- Copy `.env.example` to `.env`; never print, commit, or replace secret values. Public runtime values use the `NUXT_PUBLIC_` prefix; provider credentials remain server-only.
- Database/auth minimums are `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_URL`, and `BETTER_AUTH_SECRET`. LINE login also needs LIFF/client credentials; messaging/notifications need LINE channel credentials; uploads need Cloudinary credentials; email verification/reset needs Resend.
- Builds resolve/download fonts through Nuxt font tooling and may require outbound access to Google/Bunny/Fontsource endpoints.
- Nitro cron expressions are UTC. The package-expiry task also has an admin/secret endpoint at `/api/admin/cron/package-expiry`; preserve `CRON_SECRET` authentication for external schedulers.

## Commands

```bash
pnpm install
pnpm run dev
pnpm test
pnpm exec nuxi typecheck
pnpm run build
pnpm run preview
pnpm exec prisma migrate dev --name <migration-name>
pnpm exec prisma generate
pnpm exec prisma db seed
docker compose up --build -d
docker compose -f docker-compose.local.yml up --build -d
```

- There is no working lint script or directly executable `eslint` binary in the current package setup. Do not claim lint verification or document an invented lint command.
- `pnpm exec nuxi typecheck` is the static TypeScript/Vue check, but the current repository has pre-existing type errors. Distinguish baseline failures from errors introduced by the task.
- `pnpm run build` produces the Nitro Node server in `.output/`; it can fail in network-restricted environments while downloading fonts even after client/server compilation succeeds.
- `prisma migrate dev` uses `DIRECT_URL` and changes the connected database. Do not apply migrations, reset databases, or seed shared/staging/production data without explicit approval.
- `prisma/seed-full.ts` is not the configured default seed. `docker-compose.local.yml` runs it automatically for its disposable local/demo database; otherwise run it only when a development/demo dataset is explicitly requested.

## Docker and deployment

- `Dockerfile` is a Node 24 multi-stage build that installs with the frozen pnpm lockfile, generates Prisma Client, builds Nuxt, and runs the generated `.output/server/index.mjs` on port 3000.
- `docker-compose.yml` is the production workflow. It requires external `DATABASE_URL` and `DIRECT_URL`, runs `prisma migrate deploy` as a one-shot job before starting the app, and never creates a database or demo data.
- `docker-compose.local.yml` is the disposable local/demo workflow: PostgreSQL 16 on host port 5433, `prisma db push`, full demo seed, known test accounts, and the app on port 3000.
- No Nginx, TLS, or platform-specific infrastructure manifest is checked in. Those concerns must be provided by the production platform or reverse proxy.

## Verification and change discipline

- Run the smallest relevant check while iterating, then applicable final checks: `pnpm test` for server/domain changes, `pnpm exec nuxi typecheck` for TypeScript/Vue/API/composable changes, and `pnpm run build` for build/config/dependency changes.
- Add focused Vitest coverage for domain transitions and regressions when practical. Tests currently exercise utilities directly rather than a full database or HTTP stack.
- Do not edit `.nuxt/`, `.output/`, `app/generated/prisma/`, lockfiles, migrations, or generated assets by hand.
- Do not add production dependencies unless necessary and explicitly justified.
- Update `README.md` when setup, public behavior, API contracts, or operational workflows change. Keep operational guidance concise and verify it against the current code and configuration.
