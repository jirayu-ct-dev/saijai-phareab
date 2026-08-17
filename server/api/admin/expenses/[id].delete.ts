import { prisma } from '~~/server/utils/prisma'
import { requireRole } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['ADMIN'])

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ไม่พบรหัสรายจ่าย' })
  }

  const existing = await prisma.expense.findUnique({
    where: { id },
  })

  if (!existing || existing.deletedAt !== null) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบรายการรายจ่ายที่ระบุ' })
  }

  await prisma.expense.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedById: user.id,
    },
  })

  return {
    success: true,
    message: 'ลบรายการรายจ่ายเรียบร้อยแล้ว',
  }
})
