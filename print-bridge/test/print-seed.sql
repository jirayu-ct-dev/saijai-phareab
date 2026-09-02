-- print-seed.sql — register the disposable local test printer used by
-- docker-compose.print-test.yml. DEMO-ONLY credential ("local-bridge-credential",
-- stored as its SHA-256 hash). Never use outside the disposable local stack.
INSERT INTO "printer" (
  "id", "name", "model", "defaultTransport", "paperWidthMm", "printableDots",
  "renderMode", "capabilities", "bridgeCredentialHash", "bridgeCredentialVersion", "isActive",
  "createdAt", "updatedAt"
) VALUES (
  'prt_local_test',
  'เครื่องพิมพ์ทดสอบ (local)',
  'XP-C260M',
  'WIFI',
  80,
  576,
  'HYBRID',
  '{"partialCut":true,"nativeQr":true,"nativeBarcode":false,"pdf417":false,"nvLogo":false,"buzzer":false,"statusQuery":false,"cashDrawer":false,"blackMark":false}',
  'a2a3750ec1e9df5d8ee8b4af314e43161455c54d7529004c01522c954c84a8db',
  1,
  true,
  now(),
  now()
)
ON CONFLICT ("id") DO NOTHING;
