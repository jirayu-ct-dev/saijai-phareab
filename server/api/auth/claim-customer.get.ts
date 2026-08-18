import { z } from "zod";
import { hashCustomerClaimToken, isInternalCustomerEmail } from "~~/server/utils/customerAccount";
import { enforceCustomerClaimRateLimit } from "~~/server/utils/customerClaimRateLimit";
import { isCustomerClaimUsable } from "~~/server/utils/customerClaimState";
import { prisma } from "~~/server/utils/prisma";

const schema = z.object({ token: z.string().min(20).max(200) });

export default defineEventHandler(async (event) => {
  enforceCustomerClaimRateLimit(getRequestIP(event, { xForwardedFor: true }) || "unknown");
  const { token } = await getValidatedQuery(event, schema.parse);
  const claim = await prisma.customerClaimToken.findUnique({
    where: { tokenHash: hashCustomerClaimToken(token) },
    include: { user: { select: { name: true, email: true, phoneNumber: true, customerAccountStatus: true, deletedAt: true } } },
  });
  const valid = isCustomerClaimUsable(claim);
  if (!valid || !claim) return { valid: false, customer: null };

  return {
    valid: true,
    customer: {
      name: claim.user.name,
      phoneNumber: claim.user.phoneNumber,
      email: isInternalCustomerEmail(claim.user.email) ? null : claim.user.email,
    },
  };
});
