const BANGKOK_LOCALE = "en-CA";
const BANGKOK_TIMEZONE = "Asia/Bangkok";

const formatBangkokDate = (date: Date) =>
  new Intl.DateTimeFormat(BANGKOK_LOCALE, {
    timeZone: BANGKOK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replaceAll("-", "");

const createSuffix = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export const createServiceOrderNo = async (date = new Date()) => {
  const { getBusinessSetting } = await import("./appSetting");
  const { orderNoPrefix } = await getBusinessSetting();
  return `${orderNoPrefix}${formatBangkokDate(date)}-${createSuffix()}`;
};
