import { NextRequest, NextResponse } from "next/server";
import { buildControlPlaneUrl, buildLeadPayload } from "../../lib/marketing-site";

function cpHeaders() {
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

  const trialCode = String(body.trial ?? "").trim();
  if (!trialCode) {
    const res = await fetch(buildControlPlaneUrl("/api/marketing-site/lead"), {
      method: "POST",
      headers: cpHeaders(),
      body: JSON.stringify(payload),
    }).catch(() => null);
    if (!res) return NextResponse.json({ error: "control_plane_unreachable" }, { status: 502 });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ...data, mode: "lead_only" }, { status: res.status });
  }

  const signupRes = await fetch(buildControlPlaneUrl("/api/signup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trial: trialCode,
      email: payload.email,
      companyName: body.companyName ?? undefined,
      domain: body.domain ?? undefined,
      businessType: payload.businessType,
      utmSource: payload.utmSource,
      utmMedium: payload.utmMedium,
      utmCampaign: payload.utmCampaign,
      utmTerm: payload.utmTerm,
      utmContent: payload.utmContent,
      referral: payload.referral,
      landing: body.landing ?? undefined,
      fingerprint: body.fingerprint ?? undefined,
    }),
  }).catch(() => null);
  if (!signupRes) {
    return NextResponse.json({ error: "control_plane_unreachable" }, { status: 502 });
  }
  const signupBody = await signupRes.json().catch(() => ({}));
  return NextResponse.json({ ...signupBody, mode: "trial_signup" }, { status: signupRes.status });
}

