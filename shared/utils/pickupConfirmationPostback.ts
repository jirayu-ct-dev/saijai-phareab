export const PICKUP_CONFIRMATION_RESPONSES = [
  "HOME_PICKUP",
  "SELF_DROPOFF",
  "SKIP",
  "CONTACT_REQUESTED",
] as const;

export type PickupConfirmationResponseValue = typeof PICKUP_CONFIRMATION_RESPONSES[number];

export type PickupConfirmationPostback = {
  confirmationId: string;
  revision: number;
  response: PickupConfirmationResponseValue;
};

export function parsePickupConfirmationPostback(data: string): PickupConfirmationPostback | null {
  const params = new URLSearchParams(data);
  if (params.get("action") !== "pickup_confirmation") return null;
  const confirmationId = params.get("id")?.trim() || "";
  const revisionText = params.get("rev") || "";
  const response = params.get("response") || "";
  if (!confirmationId || !/^\d+$/.test(revisionText)) return null;
  const revision = Number(revisionText);
  if (!Number.isSafeInteger(revision) || revision < 1) return null;
  if (!PICKUP_CONFIRMATION_RESPONSES.includes(response as PickupConfirmationResponseValue)) return null;
  return { confirmationId, revision, response: response as PickupConfirmationResponseValue };
}
