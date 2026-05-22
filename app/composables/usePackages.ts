import type { Package } from '~~/shared/types/package'

// ============================================================
// Types สำหรับ Request Body
// ============================================================

export interface CreatePackageBody {
    name: string
    description?: string | null
    packageType: 'MAIN' | 'ADDON'
    isDelivery?: boolean
    deductOn?: 'CREATED' | 'COMPLETED'
    price: number
    credits?: number | null
    validityDays?: number | null
    isActive?: boolean
}

export interface UpdatePackageBody extends Partial<CreatePackageBody> {}

// ประเภท Tab ที่ใช้ใน packages.vue
export type PackageTabKey = 'all' | 'main' | 'addon'

// ============================================================
// Composable
// ============================================================

export const usePackages = () => {
    const notify = useNotify() 

    // ดึงข้อมูลแพ็กเกจทั้งหมดครั้งเดียว แล้ว filter ฝั่ง client ตาม Tab
    const {
        data: packages,
        pending,
        status,
        refresh,
    } = useFetch<Package[]>('/api/admin/packages', {
        default: () => [],
        server: false,
        lazy: true,
    })

    const loading = computed(() => pending.value || status.value === 'idle')

    // ============================================================
    // Filter ข้อมูลตาม Tab
    // ============================================================
    const getPackagesByTab = (tab: PackageTabKey): Package[] => {
        const all = packages.value ?? []
        switch (tab) {
            case 'main':
                return all.filter((p) => p.packageType === 'MAIN')
            case 'addon':
                return all.filter((p) => p.packageType === 'ADDON')
            default:
                return all
        }
    }

    // ============================================================
    // CRUD Actions
    // ============================================================

    const createPackage = async (body: CreatePackageBody): Promise<boolean> => {
        try {
            await $fetch('/api/admin/packages', { method: 'POST', body })
            await refresh()
            notify.created("สร้างแพ็กเกจสำเร็จ")
            return true
        } catch (error: any) {
            notify.error(`${error?.data?.statusMessage ?? 'ไม่สามารถสร้างแพ็กเกจได้'}`)
            return false
        }
    }

    const updatePackage = async (id: string, body: UpdatePackageBody): Promise<boolean> => {
        try {
            await $fetch(`/api/admin/packages/${id}`, { method: 'PUT', body })
            await refresh()
            notify.updated("แพ็กเกจ")
            return true
        } catch (error: any) {
            notify.error(`${error?.data?.statusMessage ?? 'ไม่สามารถอัปเดตแพ็กเกจได้'}`)
            return false
        }
    }

    const deletePackage = async (id: string, name: string): Promise<boolean> => {
        try {
            await $fetch(`/api/admin/packages/${id}`, { method: 'DELETE' })
            await refresh()
            notify.deleted(name)
            return true
        } catch (error: any) {
            notify.error(`${error?.data?.statusMessage ?? 'ไม่สามารถลบแพ็กเกจได้'}`)
            return false
        }
    }

    return {
        packages,
        loading,
        getPackagesByTab,
        createPackage,
        updatePackage,
        deletePackage,
        refresh,
    }
}
