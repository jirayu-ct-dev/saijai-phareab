import type { PackageType } from "../types/enums";

export type PackageUsageSettings = {
  isDelivery: boolean;
  deductOn: "CREATED";
  credits: number | null;
};

export const normalizePackageUsageSettings = (input: {
  packageType: PackageType;
  isDelivery?: boolean;
  credits?: number | null;
}): PackageUsageSettings => {
  const isDelivery = input.packageType === "ADDON" && Boolean(input.isDelivery);

  return {
    isDelivery,
    deductOn: "CREATED",
    credits: isDelivery ? null : input.credits ?? null,
  };
};

export const hasUsablePackageCredits = (settings: PackageUsageSettings) =>
  settings.isDelivery
  || (Number.isInteger(settings.credits) && Number(settings.credits) > 0);
