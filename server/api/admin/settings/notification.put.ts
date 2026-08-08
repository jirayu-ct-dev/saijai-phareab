import { z } from "zod/v4";
import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import {
  isInitialBeforeReminder,
  PICKUP_MINIMUM_LEAD_OPTIONS,
  PICKUP_WALL_CLOCK_PATTERN,
} from "~~/server/utils/pickupConfirmationScheduling";
import { reschedulePendingPickupNotifications } from "~~/server/utils/pickupConfirmation";

const schema = z.object({
  notifyCustomerOnQuotation: z.boolean(),
  notifyCustomerOnReceived: z.boolean(),
  notifyCustomerOnProcessing: z.boolean(),
  notifyCustomerOnDelivering: z.boolean(),
  notifyCustomerOnCompleted: z.boolean(),
  notifyCustomerOnCancelled: z.boolean(),
  notifyCustomerReceipt: z.boolean(),
  notifyStaffOnNewOrder: z.boolean(),
  notifyCustomerOnPackageExpiring: z.boolean(),
  pickupConfirmationEnabled: z.boolean(),
  pickupInitialDaysBefore: z.number().int().min(0).max(30),
  pickupInitialTime: z.string().regex(PICKUP_WALL_CLOCK_PATTERN),
  pickupReminderEnabled: z.boolean(),
  pickupReminderDaysBefore: z.number().int().min(0).max(30),
  pickupReminderTime: z.string().regex(PICKUP_WALL_CLOCK_PATTERN),
  pickupMinimumLeadMinutes: z.number().int().refine(
    (value) => (PICKUP_MINIMUM_LEAD_OPTIONS as readonly number[]).includes(value),
    { message: "ระยะเวลาเตรียมงานไม่ถูกต้อง" },
  ),
}).refine(
  (value) => !value.pickupReminderEnabled || isInitialBeforeReminder({
    initialDaysBefore: value.pickupInitialDaysBefore,
    initialTime: value.pickupInitialTime,
    reminderDaysBefore: value.pickupReminderDaysBefore,
    reminderTime: value.pickupReminderTime,
  }),
  { message: "เวลาถามครั้งแรกต้องอยู่ก่อนเวลาเตือนซ้ำ", path: ["pickupReminderTime"] },
);

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);

  const body = await readValidatedBody(event, schema.parse);

  const setting = await prisma.notificationSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...body },
    update: body,
  });

  const rescheduled = await reschedulePendingPickupNotifications();

  return { setting, rescheduled };
});
