# Package service separation

## Destination

Package definitions own a separate service catalog and included-clothing list. In POS, selecting a package shows only its included clothing; a separate action adds out-of-package clothing from any active storefront price service, chargeable by default with an explicit waive-charge control. Package, charged-extra, and free-extra lines must remain distinguishable through order edits, customer views, payment, receipts/quotations, LINE notifications, reports, and credit history.

## Constraints

- Keep the shared `StorefrontItem` catalog as the source of clothing IDs unless the product requirement explicitly calls for package-only clothing records.
- Do not rename every `serviceId`: order lines and storefront catalog rows still use that ID for the price service. Use explicit package names such as `packageServiceId` / `packageServiceName` at package boundaries.
- Preserve active package products and member entitlements, including those referencing soft-deleted legacy `StorefrontService` rows.
- Add a new Prisma migration; do not rewrite the applied `20260919000000_add_service_included_items` migration.
- Rehearse on a disposable database and take a verified backup before any production migration. Do not deploy or mutate Supabase as part of planning.
- `main` was clean at inspection (`main...origin/main`).

## Current architecture (observed)

- `PackageProduct.serviceId` is a nullable FK to `StorefrontService`; pricing and package-service CRUD therefore share one record family.
- `/admin/packages` loads `/api/admin/pricing`, then uses its service list for package services and its item/category catalog for included clothing. Its service create/update calls `/api/admin/pricing/service`.
- `/admin/pricing` also manages `StorefrontService`; the pricing API reads/writes service-included items.
- Package admin/public/POS catalog endpoints expose the relation under generic `serviceId` / `serviceName` fields.
- POS filters package catalog items by the package entitlement's `serviceId`. Both service-order create and edit handlers enforce the same service-ID plus included-item-ID match server-side via `shared/utils/packageCatalog.ts`.
- Seeds and fixtures currently bind package products and included clothing to storefront service IDs.
- Admin package endpoints are ADMIN-only; package catalog and service-order flows permit EMPLOYEE and ADMIN. A new admin package-service family needs explicit auth policy and handler checks.
- `/api/admin/storefront-catalog` is built from active `StorefrontPrice` rows, so it returns price-service/item variants rather than a standalone clothing catalog. Customer entitlement options currently expose package clothing IDs but not their item names.
- `ServiceOrderItem` has nullable `storefrontPriceId` and `isPackageIncluded`, but no direct `StorefrontItem` FK and no independent charge/waive flag. Current package rows are persisted by splitting allocated quantities into included (zero total) and cash rows.
- POS credit allocation currently treats every order line as package-covered when an entitlement is selected. Create/edit APIs both reject any line not in the package's current service+item rule; there is no “extra but chargeable/waived” path.
- Customer order details and payment details rely on `isPackageIncluded`; receipt/quotation components also infer package credits from zero line totals on any member order. That would mislabel a waived out-of-package garment as credits.
- `notifyQuotationCreated` currently skips every order with a member entitlement, even if the order has a positive payable amount. `notifyReceipt`'s staff LINE item rows show catalog unit prices without distinguishing package-included lines.
- Editing an order currently recalculates and updates its existing payment amount while leaving payment status/receipt identity in place; a paid-order edit can therefore silently change the amount represented by an issued receipt.
- Other consumers include customer/admin order lists and details, payment lists/details, admin customer history, membership usage, CSV order/sales/employee reports, print and direct-print documents, and status/receipt LINE messages.

## Production data observations (read-only aggregate query)

- There are 11 non-deleted MAIN package products, all currently active; all 11 reference a service.
- Those packages reference four distinct legacy service rows. Two of the four are soft-deleted, yet are still referenced by four active packages.
- Four of eight active, non-deleted MAIN member entitlements reference one of those soft-deleted legacy services.
- The four package-referenced services have 28 included-clothing associations; the table has 96 associations overall.
- Backfill must include soft-deleted source services and package/entitlement references. Filtering source services to active or non-deleted rows would break existing entitlements.

## Confirmed behavior and remaining frontier

1. **Confirmed:** package services are a separate domain/catalog from storefront price services. A package service owns its own name/description and included-clothing list; it must not reuse or be edited through `StorefrontService` CRUD. Storefront price service remains the pricing choice for paid order lines.
2. **Confirmed POS behavior:** with a package selected, initially show only its included clothing. An explicit add action exposes clothing/service choices outside the package, from any active storefront price service. Added lines are chargeable by default; staff can turn charging off. A waived extra is outside the package and must not consume package credits.

### Frontier

- [D1] Represent included clothing on an order without choosing a storefront price service — open. Proposed: add a direct `ServiceOrderItem.storefrontItemId` relation, keep `storefrontPriceId` nullable for priced extras, and backfill the direct item relation from historical price rows.
- [D2] Persist and validate charge state — open. Proposed: keep `isPackageIncluded` exclusively for credit-covered lines and add an explicit `isChargeable` (or equivalent pricing-mode field). Invariant: package-included lines consume credits and are not cash-chargeable; out-of-package lines default chargeable; waived extras are neither package-included nor charged.
- [D3] Whether the charge toggle applies to the entire selected line quantity or supports splitting quantity into charged and waived portions — open; default proposal is one toggle for the whole line.
- [D4] Order edits after payment — blocked by existing behavior that updates a paid payment amount without a new payment/receipt transition. Prefer preventing financial edits after payment or requiring a separate audited adjustment/refund/collection flow.
- [D5] Status/document path for a zero-payable order containing only waived extras and no package-covered line — open. It must not produce an unpaid zero-baht quotation or imply credits were used.
- [D6] Confirm the clothing master remains shared `StorefrontItem`; package-only labels outside that catalog would require a separate item source. Added chargeable extras are assumed to require an active storefront price row; no-price extras need a separate manual-price rule.
- [D7] Legacy lifecycle: migrate package-referenced legacy services into package-owned records and preserve active package/entitlement access regardless of source service soft-deletion state. Evidence favors keeping copied package services usable.

## Proposed implementation sequence (not started)

1. Add package-owned service tables and `PackageProduct.packageServiceId`. In a new expand migration, backfill relevant legacy package products/services (including soft-deleted sources) and preserve old columns/tables until cutover is verified.
2. Add a direct clothing relation to order lines and an explicit charge-state field. Backfill historical item IDs from `StorefrontPrice`; derive old chargeability as the inverse of `isPackageIncluded`, preserving historical unit/total-price snapshots.
3. Add ADMIN-only package-service APIs and separate the admin package UI from pricing CRUD. Expose package entitlement clothing IDs and names to POS independently of price rows.
4. In POS, render included items from the package clothing catalog only. Add a separate picker for active storefront service/item price rows; new extras default chargeable, can be waived, and never consume package credits. Preserve ranged/manual-price handling and notes/photos.
5. Update request schemas and both create/edit order handlers to resolve items/prices server-side, validate included lines against the selected package, reject client-forged inclusion/charge flags, allocate credits only to included lines, and calculate discount/VAT/payable totals only from chargeable amounts plus existing fees. Define zero-payable handling and guard paid-order edits.
6. Update customer/admin order and payment payloads/types/views, admin edit modal, membership usage, exports, receipt/quotation components, print/direct-print builders, and LINE order/status/quotation/receipt messages. Show three distinct meanings: package-credit line, chargeable extra, waived extra.
7. Split normal/full seeds and fixtures. Test package-only catalog filtering, any-service extras, default charge/waive, credit isolation, mixed totals, zero-payable state, paid-order edit protection, customer document labels, LINE quotation eligibility, print parity, reports, and legacy backfill.
8. Verify `pnpm test`, `pnpm exec nuxi typecheck` (separate baseline errors), and applicable build. Rehearse migration chain on a disposable DB; note the repository's overlapping index operations in `20260519000000_db_audit_fixes` and `20260522000000_reconcile_schema`. Do not apply to Supabase without a separate explicit deployment request, verified backup, and migration preflight.
9. After cutover validation, remove legacy package-service coupling and inclusion tables only if no consumer still depends on them; use a later contract migration.

## Out of scope

- Implementation and all Supabase writes remain out of scope for this inspection/plan.
- No production migration, seed, deployment, or change to live order/payment data is authorized by this map.
