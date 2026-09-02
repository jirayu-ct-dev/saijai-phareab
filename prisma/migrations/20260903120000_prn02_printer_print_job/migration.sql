-- PRN-02 — Printer/PrintJob schema (plan-database-printing-master-orchestration.md, C7–C12)
--
-- Purely additive: two new tables ("printer", "print_job"), five new enum
-- types, new FKs, and the print_job idempotency unique index. No data, no
-- backfill, no drops, no renames.
--
-- This file must never contain endpoints, IP addresses or Wi-Fi credentials:
-- the connection profile is an opaque JSON column and bridge credentials are
-- stored only as hash + version (application-managed, not migrated here).

-- CreateEnum
CREATE TYPE "PrinterModel" AS ENUM ('XP-C260M');

-- CreateEnum
CREATE TYPE "PrintTransport" AS ENUM ('WIFI', 'ETHERNET', 'USB', 'BLUETOOTH');

-- CreateEnum
CREATE TYPE "PrintRenderMode" AS ENUM ('RASTER', 'HYBRID');

-- CreateEnum
CREATE TYPE "PrintDocumentKind" AS ENUM ('RECEIPT', 'QUOTATION');

-- CreateEnum
CREATE TYPE "PrintJobStatus" AS ENUM ('QUEUED', 'CLAIMED', 'RENDERING', 'READY', 'SENDING', 'SENT', 'ACKNOWLEDGED', 'RETRY_WAIT', 'STALE_DOCUMENT', 'NEEDS_REVIEW', 'RESOLVED_PRINTED', 'RESOLVED_NOT_PRINTED', 'REPRINTED', 'FAILED');

-- CreateTable
CREATE TABLE "printer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" "PrinterModel" NOT NULL DEFAULT 'XP-C260M',
    "defaultTransport" "PrintTransport" NOT NULL,
    "paperWidthMm" INTEGER NOT NULL,
    "printableDots" INTEGER NOT NULL,
    "renderMode" "PrintRenderMode" NOT NULL DEFAULT 'HYBRID',
    "capabilities" JSONB NOT NULL DEFAULT '{"partialCut":false,"nativeQr":false,"nativeBarcode":false,"pdf417":false,"nvLogo":false,"buzzer":false,"statusQuery":false,"cashDrawer":false,"blackMark":false}',
    "connectionProfile" JSONB,
    "bridgeCredentialHash" TEXT,
    "bridgeCredentialVersion" INTEGER,
    "bridgeVersion" TEXT,
    "lastHeartbeatAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "printer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_job" (
    "id" TEXT NOT NULL,
    "printerId" TEXT NOT NULL,
    "kind" "PrintDocumentKind" NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "documentRevision" INTEGER NOT NULL,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'QUEUED',
    "sourcePaymentId" TEXT NOT NULL,
    "sourceStatus" "PaymentStatus" NOT NULL,
    "sourceRevision" INTEGER NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "qrConfigVersion" INTEGER,
    "snapshotHasPaymentQr" BOOLEAN NOT NULL,
    "snapshot" JSONB NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "renderVersion" TEXT NOT NULL,
    "snapshotExpiresAt" TIMESTAMP(3),
    "requestedById" TEXT NOT NULL,
    "selectedTransport" "PrintTransport" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reprintOfId" TEXT,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "sendStartedAt" TIMESTAMP(3),
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "fencingToken" INTEGER,
    "failureCode" TEXT,
    "failureMessageSafe" TEXT,
    "timeline" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "print_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "print_job_idempotency_scope" ON "print_job"("requestedById", "kind", "documentId", "selectedTransport", "idempotencyKey");

-- CreateIndex
CREATE INDEX "print_job_status_availableAt_idx" ON "print_job"("status", "availableAt");

-- CreateIndex
CREATE INDEX "print_job_printerId_idx" ON "print_job"("printerId");

-- CreateIndex
CREATE INDEX "print_job_sourcePaymentId_idx" ON "print_job"("sourcePaymentId");

-- CreateIndex
CREATE INDEX "print_job_reprintOfId_idx" ON "print_job"("reprintOfId");

-- AddForeignKey
ALTER TABLE "print_job" ADD CONSTRAINT "print_job_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "printer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_job" ADD CONSTRAINT "print_job_sourcePaymentId_fkey" FOREIGN KEY ("sourcePaymentId") REFERENCES "payment_record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_job" ADD CONSTRAINT "print_job_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_job" ADD CONSTRAINT "print_job_reprintOfId_fkey" FOREIGN KEY ("reprintOfId") REFERENCES "print_job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
