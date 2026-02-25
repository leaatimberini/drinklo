import { NextRequest, NextResponse } from "next/server";
import { buildControlPlaneUrl, buildLeadPayload } from "../../lib/marketing-site";

function forwardHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.MARKETING_SITE_INGEST_TOKEN) {
    headers["x-marketing-site-token"] = process.env.MARKETING_SITE_INGEST_TOKEN;
  }
  return headers;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const payload = buildLeadPayload({
    email: body.email,
    businessType: body.businessType,
    city: body.city,
    trial: body.trial,
    companyName: body.companyName,
    domain: body.domain,
    consentMarketing: body.consentMarketing,
    utm: {
      utmSource: body.utmSource,
      utmMedium: body.utmMedium,
      utmCampaign: body.utmCampaign,
      utmTerm: body.utmTerm,
      utmContent: body.utmContent,
      referral: body.referral,
    },
  });

  const cpRes = await fetch(buildControlPlaneUrl("/api/marketing-site/lead"), {
    method: "POST",
    headers: forwardHeaders(),
    body: JSON.stringify(payload),
  }).catch(() => null);

  if (!cpRes) {
    return NextResponse.json({ error: "control_plane_unreachable" }, { status: 502 });
  }
  const cpBody = await cpRes.json().catch(() => ({}));
  return NextResponse.json(cpBody, { status: cpRes.status });
}

