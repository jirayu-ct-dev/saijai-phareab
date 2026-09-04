-- Direct Print cutover: the application no longer stores printers or print
-- jobs. Intentionally no CASCADE and no IF EXISTS: an unexpected dependency
-- or schema drift must stop deployment for investigation.

DROP TABLE "print_job";
DROP TABLE "printer";

DROP TYPE "PrintJobStatus";
DROP TYPE "PrintDocumentKind";
DROP TYPE "PrintRenderMode";
DROP TYPE "PrintTransport";
DROP TYPE "PrinterModel";
