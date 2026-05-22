-- Quotation/Receipt split: add PaymentMethod / PaymentStatus, quotationNo / receiptNo,
-- payment confirmation fields, audit log table, and new BusinessSetting / NotificationSetting columns.
-- Backfills existing rows non-destructively.

-- 1. Enums --------------------------------------------------------------------

CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER');

CREATE TYPE "PaymentStatus" AS ENUM (
    'UNPAID',
    'PENDING_VERIFICATION',
    'PAID',
    'PARTIALLY_PAID',
    'CANCELLED'
);

CREATE TYPE "PaymentAuditAction" AS ENUM (
    'CREATED',
    'CONFIRMED',
    'CANCELLED',
    'SLIP_UPLOADED',
    'UPDATED'
);

-- 2. ServiceOrder.quotationNo -------------------------------------------------

ALTER TABLE "service_order" ADD COLUMN "quotationNo" TEXT;

CREATE UNIQUE INDEX "service_order_quotationNo_key" ON "service_order"("quotationNo");

-- 3. PaymentRecord new columns ------------------------------------------------

ALTER TABLE "payment_record"
    ADD COLUMN "receiptNo"     TEXT,
    ADD COLUMN "status"        "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    ADD COLUMN "method"        "PaymentMethod",
    ADD COLUMN "confirmedAt"   TIMESTAMP(3),
    ADD COLUMN "confirmedById" TEXT;

CREATE UNIQUE INDEX "payment_record_receiptNo_key" ON "payment_record"("receiptNo");
CREATE INDEX "payment_record_receiptNo_idx" ON "payment_record"("receiptNo");
CREATE INDEX "payment_record_status_createdAt_idx" ON "payment_record"("status", "createdAt");

ALTER TABLE "payment_record"
    ADD CONSTRAINT "payment_record_confirmedById_fkey"
    FOREIGN KEY ("confirmedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. PaymentAuditLog ----------------------------------------------------------

CREATE TABLE "payment_audit_log" (
    "id"         TEXT NOT NULL,
    "paymentId"  TEXT NOT NULL,
    "action"     "PaymentAuditAction" NOT NULL,
    "actorId"    TEXT,
    "beforeJson" JSONB,
    "afterJson"  JSONB,
    "note"       TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_audit_log_paymentId_createdAt_idx" ON "payment_audit_log"("paymentId", "createdAt");
CREATE INDEX "payment_audit_log_actorId_idx" ON "payment_audit_log"("actorId");

ALTER TABLE "payment_audit_log"
    ADD CONSTRAINT "payment_audit_log_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "payment_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_audit_log"
    ADD CONSTRAINT "payment_audit_log_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. BusinessSetting prefixes -------------------------------------------------

ALTER TABLE "business_setting"
    ADD COLUMN "quotationNoPrefix" TEXT NOT NULL DEFAULT 'QT-',
    ADD COLUMN "receiptNoPrefix"   TEXT NOT NULL DEFAULT 'RC-';

-- 6. NotificationSetting ------------------------------------------------------

ALTER TABLE "notification_setting"
    ADD COLUMN "notifyCustomerOnQuotation" BOOLEAN NOT NULL DEFAULT true;

-- 7. Backfill -----------------------------------------------------------------
-- Existing service orders: copy orderNo into quotationNo so old orders have a quotation document.
UPDATE "service_order"
SET "quotationNo" = "orderNo"
WHERE "quotationNo" IS NULL AND "orderNo" IS NOT NULL;

-- Existing payments that are already paid (paidAt IS NOT NULL):
--   - mark status=PAID
--   - assume CASH (no historical method data)
--   - copy paymentNo into receiptNo
--   - set confirmedAt = paidAt
UPDATE "payment_record"
SET "status"      = 'PAID',
    "method"      = 'CASH',
    "receiptNo"   = "paymentNo",
    "confirmedAt" = "paidAt"
WHERE "paidAt" IS NOT NULL
  AND "deletedAt" IS NULL;

-- Existing payments not yet paid stay status=UNPAID (default).
