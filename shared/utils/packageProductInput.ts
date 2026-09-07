import { z } from "zod";

const packageProductFields = {
  name: z.string().trim().min(1, "กรุณากรอกชื่อแพ็กเกจ"),
  description: z.string().trim().nullable().optional(),
  packageType: z.enum(["MAIN", "ADDON"]),
  isDelivery: z.boolean().optional(),
  deductOn: z.enum(["CREATED", "COMPLETED"]).optional(),
  price: z.number().finite().min(0, "กรุณากรอกราคาที่ถูกต้อง"),
  credits: z.number().int().positive().nullable().optional(),
  validityDays: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  serviceId: z.string().trim().min(1).nullable().optional(),
};

export const createPackageProductSchema = z.object({
  ...packageProductFields,
  packageType: packageProductFields.packageType.default("MAIN"),
}).strict();

export const updatePackageProductSchema = z.object(packageProductFields).partial().strict();
