# Repository Guidance

## Core Rule
- Inspect existing code before implementing anything new.
- Prefer reusing existing files, components, composables, utils, services, types, and config over creating new ones.
- Keep diffs minimal and localized.
- Match existing naming, folder structure, UI patterns, API style, and Prisma/data-access patterns.
- Explain what existing code will be reused before implementation.
- Report uncertainty instead of guessing.
- Check the nearest existing page, composable, API handler, and Prisma query in the same feature area before adding new code.

## Required Exploration First
- Read the relevant area before editing:
  - Frontend: `app/pages`, `app/layouts`, `app/components`, `app/middleware`
  - Shared logic: `app/composables`, `app/utils`, `shared/config`, `shared/types`, `shared/utils`
  - Backend: `server/api`, `server/middleware`, `server/utils`
  - Database: `prisma/schema.prisma`, related route handlers using Prisma
- Identify existing building blocks and reference files before adding code.
- Do not start feature implementation until the relevant structure and conventions are clear.

## Reuse Before Recreate
- Reuse admin data composables before adding new fetch/mutation wrappers:
  - `app/composables/useAdminUsers.ts`
  - `app/composables/useAdminPayments.ts`
  - `app/composables/useAdminSales.ts`
  - `app/composables/useAdminServiceOrders.ts`
  - `app/composables/useStorefrontCatalog.ts`
  - `app/composables/usePackageCatalog.ts`
  - `app/composables/useAdminCustomerOptions.ts`
- Reuse shared presentation/config utilities before adding duplicate mapping logic:
  - `shared/config/packageConfig.ts`
  - `shared/config/paymentConfig.ts`
  - `shared/config/orderConfig.ts`
  - `shared/config/posConfig.ts`
  - `shared/utils/format.ts`
  - `shared/utils/table.ts`
  - `shared/utils/random.ts`
- Reuse existing UI building blocks before creating new generic UI:
  - `app/components/UI/*`
  - `app/components/admin/dashboard/*`
  - `app/components/admin/packages/*`
  - `app/components/admin/pos/*`
  - `app/components/admin/pricing/*`
- Reuse auth/session helpers before introducing alternate auth flows:
  - `app/composables/useUser.ts`
  - `app/composables/useLiffAuth.ts`
  - `app/utils/auth.ts`
  - `app/utils/auth-client.ts`
  - `server/middleware/auth-session.ts`
  - `server/utils/auth.ts`

## Conventions To Preserve
- Nuxt 4 app structure with app code under `app/`, API handlers under `server/api`, shared types/config under `shared/`.
- Prefer direct Prisma usage inside route handlers and small server utils rather than introducing a new repository layer unless the repo already has one for that area.
- Preserve current route naming style:
  - collection endpoints: `index.get.ts`, `index.post.ts`
  - item endpoints: `[id].get.ts`, `[id].put.ts`, `[id].delete.ts`
  - nested item actions: e.g. `[id]/receipt.get.ts`, `[id]/intake.get.ts`
- Preserve the route names that actually exist in `app/pages`; reuse `/admin/service-orders` rather than inventing a parallel `/admin/orders` area.
- Preserve current access-control style:
  - server-side authorization via `requireRole` / `requireMember`
  - route gating in `server/middleware/auth-session.ts`
  - page gating in `app/middleware/*`
- Preserve current admin UI style:
  - `UDashboardPanel`, `UDashboardNavbar`, `UDashboardToolbar`
  - Nuxt UI tables, cards, badges, modals, dropdowns
  - shared badge/label maps from `shared/config/*`
- Prefer shared type imports from `shared/types/*` and existing composable-local DTOs where already established.
- Preserve the current API response shaping pattern: convert Prisma decimals to plain numbers in handlers before returning payloads.
- Preserve the current soft-delete discipline by checking `deletedAt: null` on applicable models instead of introducing alternate deletion behavior.

## Duplication Rules
- Do not create duplicate components, composables, utils, or services if a nearby pattern already exists.
- Do not duplicate error-extraction and notify patterns across new admin composables; follow the existing composable shape first.
- Do not recreate formatting helpers for currency, date, credits, days, labels, or colors when `shared/utils/format.ts` or `shared/config/*` already covers them.
- Do not create parallel auth helpers, Prisma clients, or session state containers.
- Do not add new mock/static data sources if the repo already has the needed config or seed data.
- Do not recreate walk-in customer handling; reuse `server/utils/walkInCustomer.ts` and existing customer-option filtering.

## Safe Change Policy
- Safe to auto-fix only when the change is small, localized, high-confidence, low-risk, behavior-preserving, and does not affect public API, auth, database, payment, routing, or shared contracts.
- Examples of safe fixes:
  - obvious typos
  - duplicate or unused imports
  - trivial dead code
  - very small local lint/type fixes with no behavior change
- Do not automatically change:
  - Prisma schema or migrations
  - auth or permission logic
  - payment logic
  - routing structure
  - cross-module refactors
  - dependency changes
  - file moves or renames
  - anything with ambiguous intent
- Before any automatic fix, state what was found, why it is safe, and keep the diff minimal.

## Reference Files
- Frontend/admin references:
  - `app/layouts/admin.vue`
  - `app/pages/admin/index.vue`
  - `app/pages/admin/users/index.vue`
  - `app/pages/admin/users/[id].vue`
  - `app/components/admin/pos/StorefrontPosWorkspace.vue`
  - `app/components/admin/pos/PackagePosWorkspace.vue`
- Shared logic references:
  - `app/composables/useUser.ts`
  - `app/composables/useAdminUsers.ts`
  - `app/composables/useAdminPayments.ts`
  - `shared/utils/format.ts`
  - `shared/config/packageConfig.ts`
  - `shared/config/paymentConfig.ts`
  - `shared/config/orderConfig.ts`
- Backend/data references:
  - `server/middleware/auth-session.ts`
  - `server/utils/auth.ts`
  - `server/utils/prisma.ts`
  - `server/utils/walkInCustomer.ts`
  - `server/utils/paymentNo.ts`
  - `server/utils/serviceOrderNo.ts`
  - `server/api/admin/users/index.get.ts`
  - `server/api/admin/package-sales/index.post.ts`
  - `server/api/admin/service-orders/index.post.ts`
  - `server/api/admin/payments/index.get.ts`
  - `server/api/admin/customer-options.get.ts`
  - `prisma/schema.prisma`
  - `prisma/seed.ts`

## Delivery Expectations
- Summarize the relevant existing building blocks before implementation.
- State which files/patterns will be reused.
- Call out duplication risks and any uncertainty.
- If the repo already contains the feature or a close variant, extend it instead of creating a parallel implementation.
