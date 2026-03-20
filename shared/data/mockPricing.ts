export const servicesIdMap = {
    wash_iron: 's1',
    wash_fold: 's2',
    iron: 's3'
}

export const mockServicesData = [
    { id: servicesIdMap.wash_iron, name: 'ซัก-รีด' },
    { id: servicesIdMap.wash_fold, name: 'ซัก-พับ' },
    { id: servicesIdMap.iron, name: 'รีด' }
]

export const mockCategoriesData = [
    { id: 'c1', name: 'กลุ่มเสื้อ', description: '' },
    { id: 'c2', name: 'กลุ่มกางเกง/กระโปรง', description: '' },
    { id: 'c3', name: 'กลุ่มชุดเดรส (ซักแห้ง)', description: '' },
    { id: 'c4', name: 'กลุ่มของใช้ในบ้าน', description: '' },
    { id: 'c5', name: 'อื่นๆ', description: '' }
]

export const mockItemsData = [
    // กลุ่มเสื้อ
    { id: 'i1', name: 'เสื้อยืดแขนสั้น', categoryId: 'c1' },
    { id: 'i2', name: 'เสื้อยืดแขนยาว', categoryId: 'c1' },
    { id: 'i3', name: 'เสื้อโปโล', categoryId: 'c1' },
    { id: 'i4', name: 'เสื้อเชิ้ตแขนสั้น', categoryId: 'c1' },
    { id: 'i5', name: 'เสื้อเชิ้ตแขนยาว', categoryId: 'c1' },
    { id: 'i6', name: 'เสื้อซับใน / เสื้อกล้าม', categoryId: 'c1' },
    { id: 'i7', name: 'เสื้อแจ็คเก็ต / กันหนาวบาง', categoryId: 'c1' },
    { id: 'i8', name: 'เสื้อกันหนาวหนา / เสื้อฮู้ด', categoryId: 'c1' },
    
    // กลุ่มกางเกง/กระโปรง
    { id: 'i9', name: 'กางเกงขาสั้น', categoryId: 'c2' },
    { id: 'i10', name: 'กางเกงยีนส์', categoryId: 'c2' },
    { id: 'i11', name: 'กางเกงสแลค / ทำงาน', categoryId: 'c2' },
    { id: 'i12', name: 'กระโปรง (ทรงสอบ/สั้น)', categoryId: 'c2' },
    { id: 'i13', name: 'กระโปรงยาว / พลีท', categoryId: 'c2', description: 'ราคาช่วงซัก-รีด: 40-60, รีด: 30-50' },
    
    // กลุ่มชุดเดรส (ซักแห้ง)
    { id: 'i14', name: 'ชุดเดรสสั้น', categoryId: 'c3' },
    { id: 'i15', name: 'ชุดลูกไม้ / เสื้อลูกไม้', categoryId: 'c3' },
    { id: 'i16', name: 'ชุดเดรสยาว', categoryId: 'c3' },
    
    // กลุ่มของใช้ในบ้าน
    { id: 'i17', name: 'ผ้าเช็ดตัว', categoryId: 'c4' },
    { id: 'i18', name: 'ปลอกหมอน', categoryId: 'c4' },
    { id: 'i19', name: 'ผ้าปูที่นอน 3.5 ฟุต', categoryId: 'c4' },
    { id: 'i20', name: 'ผ้าปูที่นอน 5-6 ฟุต', categoryId: 'c4' },
    { id: 'i21', name: 'ผ้านวม 3.5 ฟุต', categoryId: 'c4', description: 'ราคาช่วงซัก-พับ 120-150' },
    { id: 'i22', name: 'ผ้านวม 5-6 ฟุต', categoryId: 'c4', description: 'ราคาช่วงซัก-พับ 220-250' },
    { id: 'i23', name: 'ผ้าม่าน (ต่อตารางเมตร)', categoryId: 'c4', description: 'ซัก-รีด 80-100/ตร.ม., ซัก-พับ 50-80/ตร.ม.' },
]

export const mockPricesData = [
    // 1. เสื้อยืดแขนสั้น
    { storefrontItemId: 'i1', storefrontServiceId: 's1', price: 15 },
    { storefrontItemId: 'i1', storefrontServiceId: 's2', price: 10 },
    { storefrontItemId: 'i1', storefrontServiceId: 's3', price: 10 },
    // 2. เสื้อยืดแขนยาว
    { storefrontItemId: 'i2', storefrontServiceId: 's1', price: 20 },
    { storefrontItemId: 'i2', storefrontServiceId: 's2', price: 12 },
    { storefrontItemId: 'i2', storefrontServiceId: 's3', price: 15 },
    // 3. เสื้อโปโล
    { storefrontItemId: 'i3', storefrontServiceId: 's1', price: 20 },
    { storefrontItemId: 'i3', storefrontServiceId: 's2', price: 12 },
    { storefrontItemId: 'i3', storefrontServiceId: 's3', price: 15 },
    // 4. เสื้อเชิ้ตแขนสั้น
    { storefrontItemId: 'i4', storefrontServiceId: 's1', price: 25 },
    { storefrontItemId: 'i4', storefrontServiceId: 's2', price: 15 },
    { storefrontItemId: 'i4', storefrontServiceId: 's3', price: 20 },
    // 5. เสื้อเชิ้ตแขนยาว
    { storefrontItemId: 'i5', storefrontServiceId: 's1', price: 35 },
    { storefrontItemId: 'i5', storefrontServiceId: 's2', price: 15 },
    { storefrontItemId: 'i5', storefrontServiceId: 's3', price: 25 },
    // 6. เสื้อซับใน / เสื้อกล้าม
    { storefrontItemId: 'i6', storefrontServiceId: 's2', price: 7 },
    { storefrontItemId: 'i6', storefrontServiceId: 's3', price: 7 },
    // 7. เสื้อแจ็คเกต / กันหนาวบาง
    { storefrontItemId: 'i7', storefrontServiceId: 's1', price: 45 },
    { storefrontItemId: 'i7', storefrontServiceId: 's2', price: 25 },
    { storefrontItemId: 'i7', storefrontServiceId: 's3', price: 30 },
    // 8. เสื้อกันหนาวหนา / เสื้อฮู้ด
    { storefrontItemId: 'i8', storefrontServiceId: 's1', price: 55 },
    { storefrontItemId: 'i8', storefrontServiceId: 's2', price: 35 },
    { storefrontItemId: 'i8', storefrontServiceId: 's3', price: 40 },

    // 9. กางเกงขาสั้น
    { storefrontItemId: 'i9', storefrontServiceId: 's1', price: 15 },
    { storefrontItemId: 'i9', storefrontServiceId: 's2', price: 10 },
    { storefrontItemId: 'i9', storefrontServiceId: 's3', price: 10 },
    // 10. กางเกงยีนส์
    { storefrontItemId: 'i10', storefrontServiceId: 's1', price: 35 },
    { storefrontItemId: 'i10', storefrontServiceId: 's2', price: 20 },
    { storefrontItemId: 'i10', storefrontServiceId: 's3', price: 20 },
    // 11. กางเกงสแลค / ทำงาน
    { storefrontItemId: 'i11', storefrontServiceId: 's1', price: 30 },
    { storefrontItemId: 'i11', storefrontServiceId: 's2', price: 15 },
    { storefrontItemId: 'i11', storefrontServiceId: 's3', price: 20 },
    // 12. กระโปรง (ทรงสอบ/สั้น)
    { storefrontItemId: 'i12', storefrontServiceId: 's1', price: 25 },
    { storefrontItemId: 'i12', storefrontServiceId: 's2', price: 15 },
    { storefrontItemId: 'i12', storefrontServiceId: 's3', price: 15 },
    // 13. กระโปรงยาว / พลีท (ราคาเริ่มต้นต่ำสุด)
    { storefrontItemId: 'i13', storefrontServiceId: 's1', price: 40 },
    { storefrontItemId: 'i13', storefrontServiceId: 's2', price: 20 },
    { storefrontItemId: 'i13', storefrontServiceId: 's3', price: 30 },

    // 14. ชุดเดรสสั้น
    { storefrontItemId: 'i14', storefrontServiceId: 's1', price: 50 },
    { storefrontItemId: 'i14', storefrontServiceId: 's2', price: 25 },
    { storefrontItemId: 'i14', storefrontServiceId: 's3', price: 35 },
    // 15. ชุดลูกไม้ / เสื้อลูกไม้
    { storefrontItemId: 'i15', storefrontServiceId: 's1', price: 70 },
    { storefrontItemId: 'i15', storefrontServiceId: 's2', price: 35 },
    { storefrontItemId: 'i15', storefrontServiceId: 's3', price: 50 },
    // 16. ชุดเดรสยาว
    { storefrontItemId: 'i16', storefrontServiceId: 's1', price: 80 },
    { storefrontItemId: 'i16', storefrontServiceId: 's2', price: 40 },
    { storefrontItemId: 'i16', storefrontServiceId: 's3', price: 50 },

    // 17. ผ้าเช็ดตัว
    { storefrontItemId: 'i17', storefrontServiceId: 's2', price: 20 },
    // 18. ปลอกหมอน
    { storefrontItemId: 'i18', storefrontServiceId: 's1', price: 15 },
    { storefrontItemId: 'i18', storefrontServiceId: 's2', price: 10 },
    { storefrontItemId: 'i18', storefrontServiceId: 's3', price: 10 },
    // 19. ผ้าปูที่นอน 3.5 ฟุต
    { storefrontItemId: 'i19', storefrontServiceId: 's1', price: 60 },
    { storefrontItemId: 'i19', storefrontServiceId: 's2', price: 30 },
    { storefrontItemId: 'i19', storefrontServiceId: 's3', price: 40 },
    // 20. ผ้าปูที่นอน 5-6 ฟุต
    { storefrontItemId: 'i20', storefrontServiceId: 's1', price: 80 },
    { storefrontItemId: 'i20', storefrontServiceId: 's2', price: 40 },
    { storefrontItemId: 'i20', storefrontServiceId: 's3', price: 50 },
    // 21. ผ้านวม 3.5 ฟุต (ราคาเริ่มต้นต่ำสุด)
    { storefrontItemId: 'i21', storefrontServiceId: 's2', price: 120 },
    // 22. ผ้านวม 5-6 ฟุต (ราคาเริ่มต้นต่ำสุด)
    { storefrontItemId: 'i22', storefrontServiceId: 's2', price: 220 },
    // 23. ผ้าม่าน (ต่อตารางเมตร) (ราคาเริ่มต้นต่ำสุด)
    { storefrontItemId: 'i23', storefrontServiceId: 's1', price: 80 },
    { storefrontItemId: 'i23', storefrontServiceId: 's2', price: 50 },
]
