# AGENTS.md

## Engineering behavior

These guidelines bias toward caution and clarity over speed. Use judgment for trivial tasks.

### Think before coding

- Restate the concrete goal and define what observable result will count as complete.
- Inspect the relevant code, tests, documentation, and working-tree state before editing.
- Surface assumptions that materially affect behavior. If ambiguity is low risk, choose the simplest reasonable interpretation and state it; ask only when a wrong choice would be costly or difficult to reverse.
- When multiple approaches are genuinely viable, explain the tradeoff briefly and prefer the smallest approach that satisfies the request.
- Do not hide uncertainty. Name missing evidence and verify it when possible.
- For multi-step work, use a short plan in the form `step -> verification`. Do not create ceremony for a trivial edit.

### Keep solutions simple

- Implement only what the user requested. Do not add speculative features, configuration, extension points, or compatibility layers.
- Prefer direct code over a new abstraction when the logic has only one use.
- Reuse established project patterns before inventing helpers or dependencies.
- Add error handling for realistic boundaries and failures, not impossible scenarios.
- If the implementation is much larger than the behavior warrants, stop and simplify it.

### Make surgical changes

- Every changed line must trace to the requested outcome or be necessary to keep that change correct.
- Do not refactor, reformat, rename, or clean up adjacent code unless the request requires it.
- Match the style of neighboring files even when another style might also be valid.
- Remove imports, variables, functions, and files made obsolete by the current change. Mention unrelated dead code instead of deleting it.
- Preserve unrelated user changes and never overwrite work you did not create.

### Work toward verifiable goals

- Convert vague requests into checks: reproduce a bug before fixing it, test invalid input when adding validation, and compare behavior before and after a refactor.
- Prefer a focused regression test for behavior changes when practical.
- Iterate until the defined checks pass or a concrete blocker is established.
- Report exactly what was verified, what was not run, and why. Do not claim success from inspection alone when an executable check is available.

## Project overview

- This is a Nuxt 4 and Vue 3 application for the Saijai Phareab laundry business.
- The UI is Thai-first and mobile-first. Preserve the existing friendly tone and Nuxt UI component patterns.
- Server routes use Nitro under `server/api/`.
- Persistence uses Prisma 7 with PostgreSQL. The generated client lives in `app/generated/prisma/`.
- Authentication uses Better Auth. The application has `USER`, `EMPLOYEE`, and `ADMIN` roles and also derives member status from active entitlements.
- Use `pnpm`; do not introduce npm or yarn lockfiles.

## Repository map

- `app/`: Vue pages, layouts, components, composables, middleware, and client utilities.
- `server/api/`: public, member, authentication, and administration API handlers.
- `server/utils/`: server-side domain logic and integrations.
- `server/middleware/auth-session.ts`: session hydration and centralized API access policies.
- `shared/`: types, configuration, and utilities used by both app and server code.
- `prisma/schema.prisma`: database schema; `prisma/migrations/` contains migration history.
- `tests/`: Vitest tests, currently focused on server domain transitions.
- `docs/`: product briefs, design intent, and audit notes. Check relevant briefs before changing a workflow.

## Setup and common commands

```bash
pnpm install
pnpm run dev
pnpm test
pnpm exec eslint .
pnpm exec nuxi typecheck
pnpm run build
pnpm dlx prisma generate
```

- Copy `.env.example` to `.env` for local development and fill in local values.
- Never print, commit, or replace secrets from `.env`.
- Do not run destructive database commands, reset a database, seed shared data, or apply migrations to a shared/production database without explicit user approval.

## Implementation conventions

- Prefer Nuxt auto-imports and the existing `@`, `~`, and `~~` aliases over fragile relative imports.
- Keep shared contracts in `shared/types/`; avoid duplicating API shapes in pages and handlers.
- Put reusable client data access and state in composables. Use `useNotify().serverError()` or the established notification helpers instead of `alert()`.
- Keep business transitions in `server/utils/` so they can be unit tested independently of API handlers.
- For lists and dashboards, preserve loading, empty, error, and responsive states.
- User-facing copy should remain Thai unless the surrounding surface is intentionally English.
- Use Asia/Bangkok semantics for business dates and reports. Nitro cron expressions are UTC; document any conversion.

## API and security rules

- Treat all client input as untrusted. Validate request bodies, params, and query values, preferably with the existing Zod patterns.
- Use the authentication helpers in `server/utils/auth.ts`; do not implement ad hoc session or role checks.
- Every `/api/me/**` query and mutation must enforce ownership using the authenticated user's ID. Never trust a user ID supplied by the client.
- Administration endpoints must preserve the role policy in `server/middleware/auth-session.ts`. Update that policy when adding a new protected admin route family.
- Exclude soft-deleted records with `deletedAt: null` unless the feature explicitly concerns deleted data.
- Preserve state-machine rules for service orders and payments. Add or update transition tests when changing them.
- Keep related balance, credit, payment, and status mutations atomic with a Prisma transaction.
- Convert Prisma `Decimal` values to JSON-safe application values at API boundaries using the established local pattern.
- Do not expose server-only environment variables, provider credentials, internal errors, or private customer data to the client.

## Database changes

- Update `prisma/schema.prisma` and add a migration for intentional schema changes; do not edit an existing applied migration.
- Run `pnpm dlx prisma generate` after schema changes.
- Review new relations, indexes, deletion behavior, and nullability against existing data before generating a migration.
- Update seeds only when the requested feature needs representative seed data.

## Verification

- Add or update focused Vitest coverage for domain logic and regressions.
- Run the smallest relevant check while iterating, then run the applicable final checks:
  - Tests or server/domain changes: `pnpm test`
  - TypeScript, Vue, API, or composable changes: `pnpm exec nuxi typecheck`
  - Code changes: `pnpm exec eslint .`
  - Build/config/dependency changes: `pnpm run build`
- Report any check that could not run because credentials, external services, or local infrastructure are unavailable.

## Change discipline

- Do not modify generated directories such as `.nuxt/`, `.output/`, or `app/generated/prisma/` by hand.
- Do not add production dependencies unless they are necessary; explain the reason when doing so.
- Update the relevant README or `docs/` brief when setup, public behavior, API contracts, or operational workflows change.
