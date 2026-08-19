import { normalizeThaiPhoneNumber } from "./phone";

export const isUnidentifiableLegacyCustomer = (customer: {
  name?: string | null;
  phoneNumber?: string | null;
}) => {
  const normalizedPhone = customer.phoneNumber ? normalizeThaiPhoneNumber(customer.phoneNumber) : null;
  return customer.name?.trim().startsWith("ลูกค้าเดิมไม่ระบุ") === true
    || normalizedPhone?.startsWith("000000") === true;
};
