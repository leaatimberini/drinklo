import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedPartnerByPortalCredentials } from "../../../../lib/partner-auth";
import { buildPartnerCertificationTestKit } from "../../../../lib/partner-certification";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const partner = await getAuthorizedPartnerByPortalCredentials({
    slug: sp.get("partner"),
    token: sp.get("token"),
  });
  if (!partner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    partner: { id: partner.id, slug: partner.slug, name: partner.name },
    kit: buildPartnerCertificationTestKit(),
  });
}

