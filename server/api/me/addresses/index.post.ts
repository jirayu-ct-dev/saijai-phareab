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

  const body = await readBody(event);
  const validated = addressSchema.parse(body);

  // If this is set as default, unset others
  if (validated.isDefault) {
    await prisma.userAddress.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });
  }

  const address = await prisma.userAddress.create({
    data: {
      ...validated,
      userId: user.id,
    },
  });

  return address;
});
