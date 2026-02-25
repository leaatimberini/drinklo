import { prisma } from "./prisma";
import { hashPartnerToken } from "./partner-program";

export async function getAuthorizedPartnerByPortalCredentials(input: {
  slug?: string | null;
  token?: string | null;
}) {
  const slug = (input.slug ?? "").trim().toLowerCase();
  const token = (input.token ?? "").trim();
  if (!slug || !token) return null;
  const partner = await prisma.partner.findUnique({
    where: { slug },
  });
  if (!partner || partner.status !== "ACTIVE") return null;
  const hash = hashPartnerToken(token);
  if (hash !== partner.portalTokenHash) return null;
  return partner;
}

