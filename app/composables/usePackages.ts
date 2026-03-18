import type { Package } from '~~/shared/types/package'

// ============================================================
// Types สำหรับ Request Body
// ============================================================

export interface CreatePackageBody {
    name: string
    description?: string | null
    packageType: 'MAIN' | 'ADDON'
    price: number
    credits?: number | null
    bonusCredits?: number | null
    validityDays?: number | null
    isActive?: boolean
    bundledAddons?: Array<{ addonPackageId: string; quantity: number }>
    packageBonuses?: Array<{ storefrontPriceId: string; quantity: number }>
}

export interface UpdatePackageBody extends Partial<CreatePackageBody> {}

// ประเภท Tab ที่ใช้ใน packages.vue
export type PackageTabKey = 'all' | 'main' | 'addon' | 'bundle'

// ============================================================
// Composable
// ============================================================

export const usePackages = () => {
    const toast = useToast()

    // ดึงข้อมูลแพ็กเกจทั้งหมดครั้งเดียว แล้ว filter ฝั่ง client ตาม Tab
    const {
        data: packages,
        status,
        refresh,
    } = useFetch<Package[]>('/api/admin/packages', {
        default: () => [],
    })

    const loading = computed(() => status.value === 'pending')

    // ============================================================
    // Computed: แพ็กเกจเสริมที่ Active สำหรับเลือกใน Bundle Form
    // ============================================================
    const addonPackages = computed<Package[]>(() =>
        (packages.value ?? []).filter((p) => p.packageType === 'ADDON' && p.isActive && !p.deletedAt),
    )

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
            case 'bundle':
                // Bundle tab = MAIN packages ที่มี bundledAddons อย่างน้อย 1 รายการ
                return all.filter(
                    (p) => p.packageType === 'MAIN' && (p.bundledAddons?.length ?? 0) > 0,
                )
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
            toast.add({ title: 'สร้างแพ็กเกจสำเร็จ', color: 'success', icon: 'i-lucide-check-circle' })
            return true
        } catch (error: any) {
            toast.add({
                title: 'เกิดข้อผิดพลาด',
                description: error?.data?.statusMessage ?? 'ไม่สามารถสร้างแพ็กเกจได้',
                color: 'error',
                icon: 'i-lucide-x-circle',
            })
            return false
        }
    }

    const updatePackage = async (id: string, body: UpdatePackageBody): Promise<boolean> => {
        try {
            await $fetch(`/api/admin/packages/${id}`, { method: 'PUT', body })
            await refresh()
            toast.add({ title: 'อัปเดตแพ็กเกจสำเร็จ', color: 'success', icon: 'i-lucide-check-circle' })
            return true
        } catch (error: any) {
            toast.add({
                title: 'เกิดข้อผิดพลาด',
                description: error?.data?.statusMessage ?? 'ไม่สามารถอัปเดตแพ็กเกจได้',
                color: 'error',
                icon: 'i-lucide-x-circle',
            })
            return false
        }
    }

    const deletePackage = async (id: string, name: string): Promise<boolean> => {
        try {
            await $fetch(`/api/admin/packages/${id}`, { method: 'DELETE' })
            await refresh()
            toast.add({
                title: `ลบ "${name}" สำเร็จ`,
                color: 'success',
                icon: 'i-lucide-trash-2',
            })
            return true
        } catch (error: any) {
            toast.add({
                title: 'เกิดข้อผิดพลาด',
                description: error?.data?.statusMessage ?? 'ไม่สามารถลบแพ็กเกจได้',
                color: 'error',
                icon: 'i-lucide-x-circle',
            })
            return false
        }
    }

    return {
        packages,
        loading,
        addonPackages,
        getPackagesByTab,
        createPackage,
        updatePackage,
        deletePackage,
        refresh,
    }
}
