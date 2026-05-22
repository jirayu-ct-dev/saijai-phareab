export const servicesIdMap = {
    wash_iron: 's1',
    wash_fold: 's2',
    iron: 's3',
    dry_clean: 'cmojubuag0000iwmthga44tve',
}

export const mockServicesData = [
    { id: servicesIdMap.wash_iron, name: 'ซัก-รีด' },
    { id: servicesIdMap.wash_fold, name: 'ซัก-พับ' },
    { id: servicesIdMap.iron, name: 'รีด' },
    { id: servicesIdMap.dry_clean, name: 'ซักแห้ง' },
]

export const mockCategoriesData = [
    { id: 'c1', name: 'เสื้อ', description: null },
    { id: 'c2', name: 'กางเกง/กระโปรง', description: null },
    { id: 'c3', name: 'ชุดเดรส', description: null },
    { id: 'c4', name: 'ของใช้ในบ้าน', description: null },
    { id: 'c5', name: 'อื่นๆ', description: '' },
    { id: 'c6', name: 'เสื้อผ้าอื่น ๆ', description: null },
    { id: 'cmojue2du0001iwmtktz6orw2', name: 'ชุดขาว/สูท', description: null },
]

export const mockItemsData = [
    // เสื้อ (c1)
    { id: 'i1', name: 'เสื้อยืดแขนสั้น', categoryId: 'c1' },
    { id: 'i2', name: 'เสื้อยืดแขนยาว', categoryId: 'c1' },
    { id: 'i3', name: 'เสื้อโปโล', categoryId: 'c1' },
    { id: 'i4', name: 'เสื้อเชิ้ตแขนสั้น', categoryId: 'c1' },
    { id: 'i5', name: 'เสื้อเชิ้ตแขนยาว', categoryId: 'c1' },
    { id: 'i6', name: 'เสื้อซับใน / เสื้อกล้าม', categoryId: 'c1' },
    { id: 'i7', name: 'เสื้อแจ็คเก็ต / กันหนาวบาง', categoryId: 'c1' },
    { id: 'i8', name: 'เสื้อกันหนาวหนา / เสื้อฮู้ด', categoryId: 'c1' },

    // กางเกง/กระโปรง (c2)
    { id: 'i9', name: 'กางเกงขาสั้น', categoryId: 'c2' },
    { id: 'i10', name: 'กางเกงยีนส์ (สั้น/ยาว)', categoryId: 'c2' },
    { id: 'i11', name: 'กางเกงสแลค / ทำงาน', categoryId: 'c2' },
    { id: 'i12', name: 'กระโปรง (ทรงสอบ/สั้น)', categoryId: 'c2' },
    { id: 'i13', name: 'กระโปรงยาว / พลีท', categoryId: 'c2', description: 'ซัก-รีด 40-60, รีด 30-60' },

    // ชุดเดรส (c3)
    { id: 'i14', name: 'ชุดเดรสสั้น', categoryId: 'c3' },
    { id: 'i15', name: 'ชุดลูกไม้ / เสื้อลูกไม้', categoryId: 'c3' },
    { id: 'i16', name: 'ชุดเดรสยาว', categoryId: 'c3' },

    // ของใช้ในบ้าน (c4)
    { id: 'i17', name: 'ผ้าเช็ดตัว', categoryId: 'c4' },
    { id: 'i18', name: 'ปลอกหมอน', categoryId: 'c4' },
    { id: 'i19', name: 'ผ้าปูที่นอน 3.5 ฟุต', categoryId: 'c4' },
    { id: 'i20', name: 'ผ้าปูที่นอน 5-6 ฟุต', categoryId: 'c4' },
    { id: 'i21', name: 'ผ้านวม 3.5 ฟุต', categoryId: 'c4', description: 'ซัก-พับ 120-150' },
    { id: 'i22', name: 'ผ้านวม 5-6 ฟุต', categoryId: 'c4', description: 'ซัก-พับ 220-250' },
    { id: 'i23', name: 'ผ้าม่าน (ต่อตารางเมตร)', categoryId: 'c4', description: 'ซัก-พับ 50-80, ซัก-รีด 80-100' },

    // เสื้อผ้าอื่น ๆ (c6)
    { id: 'i24', name: 'ผ้าเช็ดหน้า', categoryId: 'c6' },
    { id: 'i25', name: 'กางเกงในชุดชั้นใน', categoryId: 'c6' },
    { id: 'i26', name: 'ถุงเท้า', categoryId: 'c6' },

    // ชุดขาว/สูท (cmojue2du0001iwmtktz6orw2)
    { id: 'cmojuey0j0002iwmtcx2lnjle', name: 'ชุดปกติขาว', categoryId: 'cmojue2du0001iwmtktz6orw2', description: 'ซักแห้ง 180-200' },
    { id: 'cmojufmkb0004iwmth44splbs', name: 'หมวกขาว', categoryId: 'cmojue2du0001iwmtktz6orw2', description: 'ซักแห้ง 150-250' },
    { id: 'cmojug8rz0006iwmtkziug9fu', name: 'เบลเซอร์/เสื้อสูท', categoryId: 'cmojue2du0001iwmtktz6orw2' },
    { id: 'cmojugr9z0008iwmtmzuou7f1', name: 'กางเกงสูท', categoryId: 'cmojue2du0001iwmtktz6orw2' },
]

export const mockPricesData: Array<{
    storefrontItemId: string
    storefrontServiceId: string
    price: number
    priceMin?: number
    priceMax?: number
}> = [
    // เสื้อยืดแขนสั้น
    { storefrontItemId: 'i1', storefrontServiceId: 's1', price: 15 },
    { storefrontItemId: 'i1', storefrontServiceId: 's2', price: 10 },
    { storefrontItemId: 'i1', storefrontServiceId: 's3', price: 10 },
    // เสื้อยืดแขนยาว
    { storefrontItemId: 'i2', storefrontServiceId: 's1', price: 20 },
    { storefrontItemId: 'i2', storefrontServiceId: 's2', price: 12 },
    { storefrontItemId: 'i2', storefrontServiceId: 's3', price: 15 },
    // เสื้อโปโล
    { storefrontItemId: 'i3', storefrontServiceId: 's1', price: 20 },
    { storefrontItemId: 'i3', storefrontServiceId: 's2', price: 12 },
    { storefrontItemId: 'i3', storefrontServiceId: 's3', price: 15 },
    // เสื้อเชิ้ตแขนสั้น
    { storefrontItemId: 'i4', storefrontServiceId: 's1', price: 25 },
    { storefrontItemId: 'i4', storefrontServiceId: 's2', price: 15 },
    { storefrontItemId: 'i4', storefrontServiceId: 's3', price: 20 },
    // เสื้อเชิ้ตแขนยาว
    { storefrontItemId: 'i5', storefrontServiceId: 's1', price: 35 },
    { storefrontItemId: 'i5', storefrontServiceId: 's2', price: 15 },
    { storefrontItemId: 'i5', storefrontServiceId: 's3', price: 25 },
    // เสื้อซับใน / เสื้อกล้าม
    { storefrontItemId: 'i6', storefrontServiceId: 's2', price: 7 },
    { storefrontItemId: 'i6', storefrontServiceId: 's3', price: 7 },
    // เสื้อแจ็คเก็ต / กันหนาวบาง
    { storefrontItemId: 'i7', storefrontServiceId: 's1', price: 45 },
    { storefrontItemId: 'i7', storefrontServiceId: 's2', price: 25 },
    { storefrontItemId: 'i7', storefrontServiceId: 's3', price: 30 },
    // เสื้อกันหนาวหนา / เสื้อฮู้ด
    { storefrontItemId: 'i8', storefrontServiceId: 's1', price: 55 },
    { storefrontItemId: 'i8', storefrontServiceId: 's2', price: 35 },
    { storefrontItemId: 'i8', storefrontServiceId: 's3', price: 40 },

    // กางเกงขาสั้น
    { storefrontItemId: 'i9', storefrontServiceId: 's1', price: 15 },
    { storefrontItemId: 'i9', storefrontServiceId: 's2', price: 10 },
    { storefrontItemId: 'i9', storefrontServiceId: 's3', price: 10 },
    // กางเกงยีนส์ (มี priceMin/priceMax)
    { storefrontItemId: 'i10', storefrontServiceId: 's1', price: 35, priceMin: 35, priceMax: 45 },
    { storefrontItemId: 'i10', storefrontServiceId: 's2', price: 20, priceMin: 20, priceMax: 30 },
    { storefrontItemId: 'i10', storefrontServiceId: 's3', price: 20, priceMin: 20, priceMax: 30 },
    // กางเกงสแลค / ทำงาน
    { storefrontItemId: 'i11', storefrontServiceId: 's1', price: 30 },
    { storefrontItemId: 'i11', storefrontServiceId: 's2', price: 15 },
    { storefrontItemId: 'i11', storefrontServiceId: 's3', price: 20 },
    // กระโปรง (ทรงสอบ/สั้น)
    { storefrontItemId: 'i12', storefrontServiceId: 's1', price: 25 },
    { storefrontItemId: 'i12', storefrontServiceId: 's2', price: 15 },
    { storefrontItemId: 'i12', storefrontServiceId: 's3', price: 15 },
    // กระโปรงยาว / พลีท
    { storefrontItemId: 'i13', storefrontServiceId: 's1', price: 40, priceMin: 40, priceMax: 60 },
    { storefrontItemId: 'i13', storefrontServiceId: 's2', price: 20 },
    { storefrontItemId: 'i13', storefrontServiceId: 's3', price: 30, priceMin: 30, priceMax: 50 },

    // ชุดเดรสสั้น
    { storefrontItemId: 'i14', storefrontServiceId: 's1', price: 50 },
    { storefrontItemId: 'i14', storefrontServiceId: 's2', price: 25 },
    { storefrontItemId: 'i14', storefrontServiceId: 's3', price: 35 },
    // ชุดลูกไม้ / เสื้อลูกไม้
    { storefrontItemId: 'i15', storefrontServiceId: 's1', price: 70 },
    { storefrontItemId: 'i15', storefrontServiceId: 's2', price: 35 },
    { storefrontItemId: 'i15', storefrontServiceId: 's3', price: 50 },
    // ชุดเดรสยาว
    { storefrontItemId: 'i16', storefrontServiceId: 's1', price: 80 },
    { storefrontItemId: 'i16', storefrontServiceId: 's2', price: 40 },
    { storefrontItemId: 'i16', storefrontServiceId: 's3', price: 50 },

    // ผ้าเช็ดตัว
    { storefrontItemId: 'i17', storefrontServiceId: 's2', price: 20 },
    // ปลอกหมอน
    { storefrontItemId: 'i18', storefrontServiceId: 's1', price: 15 },
    { storefrontItemId: 'i18', storefrontServiceId: 's2', price: 10 },
    { storefrontItemId: 'i18', storefrontServiceId: 's3', price: 10 },
    // ผ้าปูที่นอน 3.5 ฟุต
    { storefrontItemId: 'i19', storefrontServiceId: 's1', price: 60 },
    { storefrontItemId: 'i19', storefrontServiceId: 's2', price: 30 },
    { storefrontItemId: 'i19', storefrontServiceId: 's3', price: 40 },
    // ผ้าปูที่นอน 5-6 ฟุต
    { storefrontItemId: 'i20', storefrontServiceId: 's1', price: 80 },
    { storefrontItemId: 'i20', storefrontServiceId: 's2', price: 40 },
    { storefrontItemId: 'i20', storefrontServiceId: 's3', price: 50 },
    // ผ้านวม 3.5 ฟุต
    { storefrontItemId: 'i21', storefrontServiceId: 's2', price: 120, priceMin: 120, priceMax: 150 },
    // ผ้านวม 5-6 ฟุต
    { storefrontItemId: 'i22', storefrontServiceId: 's2', price: 220, priceMin: 220, priceMax: 250 },
    // ผ้าม่าน (ต่อตารางเมตร)
    { storefrontItemId: 'i23', storefrontServiceId: 's1', price: 80, priceMin: 80, priceMax: 100 },
    { storefrontItemId: 'i23', storefrontServiceId: 's2', price: 50, priceMin: 50, priceMax: 80 },

    // เสื้อผ้าอื่น ๆ (c6) — ซัก-พับ อย่างเดียว
    { storefrontItemId: 'i24', storefrontServiceId: 's2', price: 20 },
    { storefrontItemId: 'i25', storefrontServiceId: 's2', price: 20 },
    { storefrontItemId: 'i26', storefrontServiceId: 's2', price: 20 },

    // ชุดขาว/สูท — ซักแห้ง
    { storefrontItemId: 'cmojuey0j0002iwmtcx2lnjle', storefrontServiceId: 'cmojubuag0000iwmthga44tve', price: 180, priceMin: 180, priceMax: 200 },
    { storefrontItemId: 'cmojufmkb0004iwmth44splbs', storefrontServiceId: 'cmojubuag0000iwmthga44tve', price: 150 },
    { storefrontItemId: 'cmojug8rz0006iwmtkziug9fu', storefrontServiceId: 'cmojubuag0000iwmthga44tve', price: 120 },
    { storefrontItemId: 'cmojugr9z0008iwmtmzuou7f1', storefrontServiceId: 'cmojubuag0000iwmthga44tve', price: 100 },
]

export const mockPackagesData: Array<{
    id: string
    name: string
    description: string | null
    packageType: 'MAIN' | 'ADDON'
    deductOn: 'CREATED' | 'COMPLETED'
    price: number
    credits: number | null
    validityDays: number | null
}> = [
    {
        id: 'cmopg27370008pkmt4296tnki',
        name: 'บริการรับส่งผ้ารายเดือน',
        description: 'รับส่ง 2 ครั้งต่อสัปดาห์ | 8 ครั้งต่อเดือน พุธ / เสาร์',
        packageType: 'ADDON',
        deductOn: 'COMPLETED',
        price: 300,
        credits: 8,
        validityDays: 30,
    },
    {
        id: 'cmopg0krl0007pkmt3pf25bij',
        name: 'S',
        description: null,
        packageType: 'MAIN',
        deductOn: 'CREATED',
        price: 850,
        credits: 50,
        validityDays: 30,
    },
    {
        id: 'cmopg051y0006pkmtjoiqmj3e',
        name: 'M',
        description: null,
        packageType: 'MAIN',
        deductOn: 'CREATED',
        price: 1290,
        credits: 90,
        validityDays: 30,
    },
    {
        id: 'cmopfz9jb0005pkmtchxlff6t',
        name: 'L',
        description: null,
        packageType: 'MAIN',
        deductOn: 'CREATED',
        price: 1690,
        credits: 150,
        validityDays: 30,
    },
]
