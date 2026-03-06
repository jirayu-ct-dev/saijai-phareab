export const useNotify = () => {
    const toast = useToast()

    // ศูนย์รวมคำแปล Error (เพิ่มคำศัพท์ในอนาคตได้ที่นี่ที่เดียว)
    const errorTranslations: Record<string, string> = {
        'Invalid email or password': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
        'User already exists': 'มีผู้ใช้งานอีเมลนี้ในระบบแล้ว',
        'Invalid credential': 'ข้อมูลการเข้าสู่ระบบไม่ถูกต้อง',
        // เพิ่ม Error อื่นๆ ของ Better Auth ได้เลย
    }
    const success = (message: string) => {
        toast.add({
            title: "สำเร็จ",
            description: message,
            icon: "i-lucide-check",
            color: 'success'
        })
    }

    /** แจ้งเตือนบันทึกข้อมูลสำเร็จ */
    const saved = (item: string = 'ข้อมูล') => {
        toast.add({
            title: 'บันทึกสำเร็จ',
            description: `${item}ถูกบันทึกแล้ว`,
            icon: 'i-lucide-check',
            color: 'success'
        })
    }

    /** แจ้งเตือนอัปเดตสำเร็จ */
    const updated = (item: string = 'ข้อมูล') => {
        toast.add({
            title: 'อัปเดตสำเร็จ',
            description: `${item}ถูกอัปเดตแล้ว`,
            icon: 'i-lucide-check',
            color: 'success'
        })
    }

    /** แจ้งเตือนสร้างสำเร็จ */
    const created = (item: string = 'รายการ') => {
        toast.add({
            title: 'สร้างสำเร็จ',
            description: `${item}ถูกสร้างแล้ว`,
            icon: 'i-lucide-plus-circle',
            color: 'success'
        })
    }

    /** แจ้งเตือนลบสำเร็จ */
    const deleted = (item: string = 'รายการ') => {
        toast.add({
            title: 'ลบสำเร็จ',
            description: `${item}ถูกลบแล้ว`,
            icon: 'i-lucide-trash-2',
            color: 'success'
        })
    }

    const error = (message: string) => {
        // เช็คว่ามีคำแปลในระบบไหม ถ้ามีให้ใช้คำแปล ถ้าไม่มีให้เผยแพร่ original message
        const translatedMessage = errorTranslations[message] || message;

        toast.add({
            title: "เกิดข้อผิดพลาด",
            description: translatedMessage,
            icon: "i-lucide-alert-octagon",
            color: 'error'
        })
    }

    /** แจ้งเตือน validation error */
    const validationError = (message: string = 'กรุณาตรวจสอบข้อมูลที่กรอก') => {
        toast.add({
            title: 'ข้อมูลไม่ถูกต้อง',
            description: message,
            icon: 'i-lucide-alert-circle',
            color: 'error'
        })
    }

    /** แจ้งเตือน server error */
    const serverError = () => {
        toast.add({
            title: 'เซิร์ฟเวอร์ขัดข้อง',
            description: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่ภายหลัง',
            icon: 'i-lucide-server-off',
            color: 'error'
        })
    }

    // ============================================================
    // Warning Notifications
    // ============================================================

    /** แจ้งเตือน warning */
    const warning = (message: string) => {
        toast.add({
            title: 'คำเตือน',
            description: message,
            icon: 'i-lucide-alert-triangle',
            color: 'warning'
        })
    }

    // ============================================================
    // Info Notifications
    // ============================================================

    /** แจ้งเตือนข้อมูลทั่วไป */
    const info = (message: string) => {
        toast.add({
            title: 'แจ้งให้ทราบ',
            description: message,
            icon: 'i-lucide-info',
            color: 'info'
        })
    }

    /** แจ้งเตือนกำลังดำเนินการ */
    const loading = (message: string = 'กำลังดำเนินการ...') => {
        toast.add({
            title: 'กรุณารอสักครู่',
            description: message,
            icon: 'i-lucide-loader-2',
            color: 'neutral'
        })
    }


    return {
        toast,
        success,
        error,
        saved,
        updated,
        created,
        deleted,
        validationError,
        serverError,
        warning,
        info,
        loading
    }
}