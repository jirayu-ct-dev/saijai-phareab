export type CustomerClaimState = {
  usedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
  user: {
    deletedAt: Date | null;
    customerAccountStatus: "OFFLINE" | "ACTIVE";
  };
};

export function isCustomerClaimUsable(
  claim: CustomerClaimState | null,
  at = new Date(),
): claim is CustomerClaimState {
  return Boolean(
    claim
      && !claim.usedAt
      && !claim.revokedAt
      && claim.expiresAt > at
      && !claim.user.deletedAt
      && claim.user.customerAccountStatus === "OFFLINE",
  );
}
