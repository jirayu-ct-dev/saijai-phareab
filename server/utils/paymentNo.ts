const BANGKOK_TIME_ZONE = "Asia/Bangkok";

const getBangkokDateParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return { year, month, day };
};

const randomSuffix = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export const createPaymentNo = async (date = new Date()) => {
  const { getBusinessSetting } = await import("./appSetting");
  const { paymentNoPrefix } = await getBusinessSetting();
  const { year, month, day } = getBangkokDateParts(date);
  return `${paymentNoPrefix}${year}${month}${day}-${randomSuffix()}`;
};
