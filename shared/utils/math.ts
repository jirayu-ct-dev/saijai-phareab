/**
 * สุ่มตัวเลขจำนวนเต็มจากค่าน้อยสุดถึงมากสุด (เอาไว้ใช้ Mock ข้อมูล)
 */
export function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * สุ่มค่าจากอาร์เรย์ (เอาไว้ใช้ Mock ข้อมูล)
 */
export function randomFrom<T>(arr: T[]): T {
    return arr[randomInt(0, arr.length - 1)] as T
}
