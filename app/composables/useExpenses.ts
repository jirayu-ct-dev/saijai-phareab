import type {
  ExpenseCategory,
  ExpenseItem,
  ExpenseListResponse,
  FinanceSummary,
  DashboardCashflowPoint,
} from '~~/shared/types/expense'

export function useExpenses() {
  const toast = useToast()

  const categories = useState<ExpenseCategory[]>('expense-categories', () => [])
  const isLoadingCategories = ref(false)

  const fetchCategories = async (options?: { activeOnly?: boolean }) => {
    isLoadingCategories.value = true
    try {
      const data = await $fetch<ExpenseCategory[]>('/api/admin/expenses/categories', {
        query: options?.activeOnly ? { activeOnly: 'true' } : undefined,
      })
      categories.value = data
      return data
    } catch (err: any) {
      toast.add({
        title: 'โหลดหมวดหมู่รายจ่ายไม่สำเร็จ',
        description: err?.data?.statusMessage || err?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล',
        color: 'error',
      })
      return []
    } finally {
      isLoadingCategories.value = false
    }
  }

  const createCategory = async (name: string) => {
    try {
      const created = await $fetch<ExpenseCategory>('/api/admin/expenses/categories', {
        method: 'POST',
        body: { name },
      })
      toast.add({
        title: 'สร้างหมวดหมู่สำเร็จ',
        description: `เพิ่มหมวดหมู่ "${created.name}" เรียบร้อยแล้ว`,
        color: 'success',
      })
      await fetchCategories()
      return created
    } catch (err: any) {
      toast.add({
        title: 'สร้างหมวดหมู่ไม่สำเร็จ',
        description: err?.data?.statusMessage || err?.message || 'เกิดข้อผิดพลาด',
        color: 'error',
      })
      throw err
    }
  }

  const updateCategory = async (id: string, payload: { name?: string; isActive?: boolean }) => {
    try {
      const updated = await $fetch<ExpenseCategory>(`/api/admin/expenses/categories/${id}`, {
        method: 'PUT',
        body: payload,
      })
      toast.add({
        title: 'อัปเดตหมวดหมู่สำเร็จ',
        description: `บันทึกการเปลี่ยนแปลงหมวดหมู่ "${updated.name}" เรียบร้อยแล้ว`,
        color: 'success',
      })
      await fetchCategories()
      return updated
    } catch (err: any) {
      toast.add({
        title: 'อัปเดตหมวดหมู่ไม่สำเร็จ',
        description: err?.data?.statusMessage || err?.message || 'เกิดข้อผิดพลาด',
        color: 'error',
      })
      throw err
    }
  }

  const deleteCategory = async (id: string) => {
    try {
      const res = await $fetch<{ success: boolean; action: string; message: string }>(`/api/admin/expenses/categories/${id}`, {
        method: 'DELETE',
      })
      toast.add({
        title: res.action === 'deactivated' ? 'ปิดใช้งานหมวดหมู่' : 'ลบหมวดหมู่สำเร็จ',
        description: res.message,
        color: res.action === 'deactivated' ? 'warning' : 'success',
      })
      await fetchCategories()
      return res
    } catch (err: any) {
      toast.add({
        title: 'ลบหมวดหมู่ไม่สำเร็จ',
        description: err?.data?.statusMessage || err?.message || 'เกิดข้อผิดพลาด',
        color: 'error',
      })
      throw err
    }
  }

  const createExpense = async (payload: {
    categoryId: string
    amount: number
    expenseAt: string
    description?: string | null
  }) => {
    try {
      const created = await $fetch<ExpenseItem>('/api/admin/expenses', {
        method: 'POST',
        body: payload,
      })
      toast.add({
        title: 'บันทึกรายจ่ายสำเร็จ',
        description: `บันทึกรายจ่ายจำนวน ${created.amount.toLocaleString()} บาท เรียบร้อยแล้ว`,
        color: 'success',
      })
      return created
    } catch (err: any) {
      toast.add({
        title: 'บันทึกรายจ่ายไม่สำเร็จ',
        description: err?.data?.statusMessage || err?.message || 'เกิดข้อผิดพลาด',
        color: 'error',
      })
      throw err
    }
  }

  const updateExpense = async (
    id: string,
    payload: {
      categoryId?: string
      amount?: number
      expenseAt?: string
      description?: string | null
    }
  ) => {
    try {
      const updated = await $fetch<ExpenseItem>(`/api/admin/expenses/${id}`, {
        method: 'PUT',
        body: payload,
      })
      toast.add({
        title: 'แก้ไขรายจ่ายสำเร็จ',
        description: `บันทึกการแก้ไขรายการรายจ่ายเรียบร้อยแล้ว`,
        color: 'success',
      })
      return updated
    } catch (err: any) {
      toast.add({
        title: 'แก้ไขรายจ่ายไม่สำเร็จ',
        description: err?.data?.statusMessage || err?.message || 'เกิดข้อผิดพลาด',
        color: 'error',
      })
      throw err
    }
  }

  const deleteExpense = async (id: string) => {
    try {
      const res = await $fetch<{ success: boolean; message: string }>(`/api/admin/expenses/${id}`, {
        method: 'DELETE',
      })
      toast.add({
        title: 'ลบรายจ่ายสำเร็จ',
        description: res.message || 'ลบรายการรายจ่ายเรียบร้อยแล้ว',
        color: 'success',
      })
      return res
    } catch (err: any) {
      toast.add({
        title: 'ลบรายจ่ายไม่สำเร็จ',
        description: err?.data?.statusMessage || err?.message || 'เกิดข้อผิดพลาด',
        color: 'error',
      })
      throw err
    }
  }

  const deleteExpensesBulk = async (ids: string[]) => {
    try {
      await Promise.all(
        ids.map((id) =>
          $fetch<{ success: boolean; message: string }>(`/api/admin/expenses/${id}`, {
            method: 'DELETE',
          })
        )
      )
      toast.add({
        title: 'ลบรายจ่ายสำเร็จ',
        description: `ลบรายการรายจ่ายจำนวน ${ids.length} รายการเรียบร้อยแล้ว`,
        color: 'success',
      })
      return true
    } catch (err: any) {
      toast.add({
        title: 'ลบรายจ่ายไม่สำเร็จ',
        description: err?.data?.statusMessage || err?.message || 'เกิดข้อผิดพลาดในการลบรายการ',
        color: 'error',
      })
      throw err
    }
  }

  return {
    categories,
    isLoadingCategories,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    createExpense,
    updateExpense,
    deleteExpense,
    deleteExpensesBulk,
  }
}

