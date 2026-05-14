import { prisma } from "~~/server/utils/prisma";
import { z } from "zod";

const addressSchema = z.object({
  address: z.string().min(1, "กรุณากรอกที่อยู่"),
  subdistrict: z.string().optional(),
  district: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  const id = getRouterParam(event, 'id');
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  const body = await readBody(event);
  const validated = addressSchema.parse(body);

  // Check ownership
  const existing = await prisma.userAddress.findUnique({
    where: { id },
  });

  if (!existing || existing.userId !== user.id) {
    throw createError({
      statusCode: 404,
      message: "Address not found",
    });
  }

  // If this is set as default, unset others
  if (validated.isDefault) {
    await prisma.userAddress.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });
  }

  const address = await prisma.userAddress.update({
    where: { id },
    data: validated,
  });

  return address;
});
