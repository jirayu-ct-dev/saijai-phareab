import { z } from "zod/v4";
import { prisma } from "~~/server/utils/prisma";
import { requireUser } from "~~/server/utils/auth";
import { normalizeThaiPhoneNumber } from "~~/shared/utils/phone";

const schema = z.object({
  name: z.string().trim().min(1).max(100).nullish(),
  phoneNumber: z.string().trim().max(20).nullish(),
  image: z.string().url().nullish(),
});

export default defineEventHandler(async (event) => {
  const actor = requireUser(event);
  const body = await readValidatedBody(event, schema.parse);
  const phoneNumber = body.phoneNumber?.trim() || null;
  const normalizedPhoneNumber = phoneNumber ? normalizeThaiPhoneNumber(phoneNumber) : null;
  if (phoneNumber && !normalizedPhoneNumber) {
    throw createError({ statusCode: 400, statusMessage: "เบอร์โทรศัพท์ไม่ถูกต้อง" });
  }

  try {
    await prisma.user.update({
      where: { id: actor.id },
      data: {
        name: body.name ?? undefined,
        phoneNumber,
        normalizedPhoneNumber,
        image: body.image ?? null,
      },
    });

    return { success: true };
  } catch (error: any) {
    if (error?.statusCode) throw error;
    if (error?.code === "P2002") {
      throw createError({ statusCode: 409, statusMessage: "เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว" });
    }
    console.error("[Profile Update Error]", error);
    throw createError({
      statusCode: 500,
      message: "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
    });
  }
});
