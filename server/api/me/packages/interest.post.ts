import { prisma } from "~~/server/utils/prisma";
import { requireUser } from "~~/server/utils/auth";
import { pushMessage } from "~~/server/utils/line-messaging";

export default defineEventHandler(async (event) => {
  const actor = requireUser(event);
  const body = await readBody(event);
  const { packageId } = body || {};

  if (!packageId) {
    throw createError({
      statusCode: 400,
      statusMessage: "กรุณาระบุรหัสแพ็กเกจ",
    });
  }

  // 1. Find the package
  const pkg = await prisma.packageProduct.findFirst({
    where: { id: packageId, deletedAt: null, isActive: true },
  });

  if (!pkg) {
    throw createError({
      statusCode: 404,
      statusMessage: "ไม่พบข้อมูลแพ็กเกจนี้ หรือแพ็กเกจถูกระงับการขายชั่วคราว",
    });
  }

  // 2. Check if user is linked to LINE
  const lineAccount = await prisma.account.findFirst({
    where: { userId: actor.id, providerId: "line" },
    select: { accountId: true },
  });

  if (!lineAccount) {
    return {
      success: false,
      hasLineLinked: false,
    };
  }

  // 3. Send LINE push message
  let pushFailed = false;
  try {
    const formattedPrice = new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(pkg.price));

    const validityText = pkg.validityDays ? `${pkg.validityDays} วัน` : "ไม่จำกัด";
    const packageTypeText = pkg.packageType === "MAIN" ? "แพ็กเกจหลัก" : "แพ็กเกจเสริม";

    const textMessage = `📢 คุณสนใจสั่งซื้อแพ็กเกจ:

📦 แพ็กเกจ: ${pkg.name} (${packageTypeText})
💰 ราคา: ${formattedPrice}
⏳ อายุการใช้งาน: ${validityText}

✨ ขณะนี้ระบบได้แจ้งความสนใจของคุณไปยังเจ้าหน้าที่เรียบร้อยแล้ว แอดมินจะดำเนินการสมัครและเปิดสิทธิ์การใช้งานให้คุณโดยเร็วที่สุดครับ! ขอบคุณที่ใช้บริการครับ 😊`;

    await pushMessage({
      to: lineAccount.accountId,
      messages: [
        {
          type: "text",
          text: textMessage,
        },
      ],
    });
  } catch (error: any) {
    console.error("[LINE package interest push failed gracefully]", error);
    pushFailed = true;
  }

  return {
    success: true,
    hasLineLinked: true,
    pushFailed,
  };
});
