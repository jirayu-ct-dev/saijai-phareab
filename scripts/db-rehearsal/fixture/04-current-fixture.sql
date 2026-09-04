-- Synthetic non-PII fixture for the consolidated schema.
BEGIN;

INSERT INTO "user" (id, email, name, "emailVerified", role, "isActive", "updatedAt") VALUES
  ('cfx_admin', 'current-admin@example.test', 'Current Admin', true, 'ADMIN', true, now()),
  ('cfx_customer', 'current-customer@example.test', 'Current Customer', true, 'USER', true, now());

INSERT INTO "business_setting" (id, name, phone, address, "updatedAt")
VALUES ('singleton', 'Current Fixture Laundry', '020000000', 'Fixture Address', now());

INSERT INTO "storefront_category" (id, name, "updatedAt") VALUES ('cfx_category', 'Fixture Category', now());
INSERT INTO "storefront_service" (id, name, "updatedAt") VALUES ('cfx_service', 'Fixture Service', now());
INSERT INTO "storefront_item" (id, name, "categoryId", "updatedAt") VALUES ('cfx_item', 'Fixture Item', 'cfx_category', now());
INSERT INTO "storefront_price" (id, "storefrontServiceId", "storefrontItemId", price, "updatedAt") VALUES ('cfx_price', 'cfx_service', 'cfx_item', 100, now());

INSERT INTO "package_product" (id, name, "packageType", price, credits, "validityDays", "updatedAt") VALUES ('cfx_product', 'Fixture Package', 'MAIN', 500, 10, 365, now());
INSERT INTO "package_sale" (id, "customerId", "soldById", "subtotalAmount", "totalAmount", "updatedAt") VALUES ('cfx_sale', 'cfx_customer', 'cfx_admin', 500, 500, now());
INSERT INTO "package_sale_item" (id, "packageSaleId", "productId", "itemType", qty, "unitPrice", "totalPrice", "updatedAt") VALUES ('cfx_sale_item', 'cfx_sale', 'cfx_product', 'MAIN', 1, 500, 500, now());
INSERT INTO "member_entitlement" (id, "customerId", "sourceSaleItemId", "productId", status, "creditInitial", "creditRemaining", "updatedAt") VALUES ('cfx_entitlement', 'cfx_customer', 'cfx_sale_item', 'cfx_product', 'ACTIVE', 10, 9, now());

INSERT INTO "image" (id, "userId", "publicId", url, "secureUrl", "updatedAt") VALUES ('cfx_image', 'cfx_customer', 'fixture/current-image', 'https://example.test/image', 'https://example.test/image', now());
INSERT INTO "service_order" (id, "orderNo", "customerId", "employeeId", status, "memberEntitlementId", "creditUsed", "subtotalAmount", "totalAmount", "completedAt", "updatedAt") VALUES
  ('cfx_order_paid', 'CFX-ORD-1', 'cfx_customer', 'cfx_admin', 'COMPLETED', 'cfx_entitlement', 1, 100, 100, now(), now()),
  ('cfx_order_open', 'CFX-ORD-2', 'cfx_customer', 'cfx_admin', 'RECEIVED', NULL, NULL, 100, 100, NULL, now());
INSERT INTO "service_order_item" (id, "serviceOrderId", "storefrontPriceId", quantity, "unitPrice", "totalPrice", "updatedAt") VALUES
  ('cfx_order_item_paid', 'cfx_order_paid', 'cfx_price', 1, 100, 100, now()),
  ('cfx_order_item_open', 'cfx_order_open', 'cfx_price', 1, 100, 100, now());
INSERT INTO "service_order_item_image" (id, "serviceOrderItemId", "imageId", "sortOrder", "updatedAt") VALUES ('cfx_photo', 'cfx_order_item_paid', 'cfx_image', 0, now());
INSERT INTO "service_order_addon_usage" (id, "serviceOrderId", "memberEntitlementId", "productId", "productName", credits, "deductedAt", "updatedAt") VALUES ('cfx_addon', 'cfx_order_paid', 'cfx_entitlement', 'cfx_product', 'Fixture Add-on', 1, now(), now());

INSERT INTO "payment_record" (id, "paymentNo", "receiptNo", "userId", "packageSaleId", amount, status, method, "paidAt", "confirmedAt", "confirmedById", "updatedAt") VALUES ('cfx_payment_sale', 'CFX-PAY-1', 'CFX-RC-1', 'cfx_customer', 'cfx_sale', 500, 'PAID', 'CASH', now(), now(), 'cfx_admin', now());
INSERT INTO "payment_record" (id, "paymentNo", "receiptNo", "userId", "serviceOrderId", amount, status, method, "paidAt", "confirmedAt", "confirmedById", "updatedAt") VALUES
  ('cfx_payment_paid', 'CFX-PAY-2', 'CFX-RC-2', 'cfx_customer', 'cfx_order_paid', 100, 'PAID', 'CASH', now(), now(), 'cfx_admin', now()),
  ('cfx_payment_open', 'CFX-PAY-3', NULL, 'cfx_customer', 'cfx_order_open', 100, 'UNPAID', NULL, NULL, NULL, NULL, now());
INSERT INTO "notification_subscriber" (id, "userId", "isActive", "updatedAt") VALUES ('cfx_subscriber', 'cfx_admin', true, now());

COMMIT;
