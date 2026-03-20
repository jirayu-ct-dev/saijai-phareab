/**
 * สุ่มรหัสผ่าน
 * @param length ความยาวรหัสผ่าน (default: 12)
 * @param options ตัวเลือกเพิ่มเติม
 */
export const randomPassword = (
  length = 12,
  options?: { symbols?: boolean },
): string => {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "!@#$%&*";

  let chars = upper + lower + digits;
  if (options?.symbols !== false) {
    chars += symbols;
  }

  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return password;
};
