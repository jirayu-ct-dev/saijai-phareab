import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler((event) => {
  requireRole(event, ["ADMIN"]);

  throw createError({
    statusCode: 410,
    statusMessage: "ยกเลิกการสร้างรายการชำระเงินแบบเดี่ยวแล้ว กรุณาใช้การขายแพ็กเกจผ่าน /api/admin/package-sales แทน",
  });
});
