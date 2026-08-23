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
  const user = requireUser(event);
  const id = getRouterParam(event, 'id');

  const validated = await readValidatedBody(event, addressSchema.parse);

  // Check ownership and not deleted
  const existing = await prisma.userAddress.findFirst({
    where: { 
      id,
      userId: user.id,
      deletedAt: null,
    },
  });

  if (!existing) {
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
