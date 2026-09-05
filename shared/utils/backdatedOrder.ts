import { z } from "zod";
import { parseBangkokDateTime } from "./pickup";

const historicalDate = z.iso.datetime({ local: true, offset: true, error: "กรุณาระบุวันและเวลาให้ถูกต้อง" }).transform((value, ctx) => {
  const date = parseBangkokDateTime(value);
  if (!date || Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: "custom", message: "กรุณาระบุวันและเวลาให้ถูกต้อง" });
    return z.NEVER;
  }
  return date;
});

export const backdatedOrderSchema = (now = new Date()) => z.object({
  receivedAt: historicalDate,
  status: z.enum(["RECEIVED", "PROCESSING", "DELIVERING", "COMPLETED"]),
  completedAt: historicalDate.optional(),
  payment: z.object({
    paidAt: historicalDate,
    method: z.enum(["CASH", "TRANSFER"]),
  }).optional(),
}).strict().superRefine((value, ctx) => {
  const dates = [
    { date: value.receivedAt, path: ["receivedAt"] },
    { date: value.completedAt, path: ["completedAt"] },
    { date: value.payment?.paidAt, path: ["payment", "paidAt"] },
  ];
  for (const { date, path } of dates) {
    if (date && date > now) ctx.addIssue({ code: "custom", path, message: "ระบุวันในอนาคตไม่ได้" });
    if (date && date < value.receivedAt) ctx.addIssue({ code: "custom", path, message: "วันเสร็จและวันรับเงินต้องไม่ก่อนวันรับผ้า" });
  }
  if ((value.status === "COMPLETED") !== Boolean(value.completedAt)) {
    ctx.addIssue({ code: "custom", path: ["completedAt"], message: "ระบุวันเสร็จจริงเฉพาะรายการที่เสร็จแล้ว" });
  }
});

export type BackdatedOrderInput = z.input<ReturnType<typeof backdatedOrderSchema>>;

export const backdatedSaleSchema = (now = new Date()) => z.object({
  soldAt: historicalDate,
  payment: z.object({
    paidAt: historicalDate,
    method: z.enum(["CASH", "TRANSFER"]),
  }).optional(),
}).strict().superRefine((value, ctx) => {
  const dates = [
    { date: value.soldAt, path: ["soldAt"] },
    { date: value.payment?.paidAt, path: ["payment", "paidAt"] },
  ];
  for (const { date, path } of dates) {
    if (date && date > now) ctx.addIssue({ code: "custom", path, message: "ระบุวันในอนาคตไม่ได้" });
    if (date && date < value.soldAt) ctx.addIssue({ code: "custom", path, message: "วันรับเงินต้องไม่ก่อนวันขายแพ็กเกจ" });
  }
});

export type BackdatedSaleInput = z.input<ReturnType<typeof backdatedSaleSchema>>;
