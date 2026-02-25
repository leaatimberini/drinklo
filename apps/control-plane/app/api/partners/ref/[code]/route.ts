import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import {
  buildAttributionCookie,
  detectBasicLeadFraud,
  emailDomain,
  getRequestIp,
  normalizeDomain,
} from "../../../../lib/partner-program";

export async function GET(req: NextRequest, ctx: any) {
  const code = String(ctx?.params?.code ?? "").trim().toLowerCase();
  if (!code) {
    return NextResponse.json({ error: "missing code" }, { status: 400 });
  }

  const link = await prisma.referralLink.findUnique({
    where: { code },
    include: {
      partner: true,
      commissionPlan: true,
    },
  });
  if (!link || link.status !== "ACTIVE" || link.partner.status !== "ACTIVE") {
    return NextResponse.json({ error: "referral link not found" }, { status: 404 });
  }

  const sp = req.nextUrl.searchParams;
  const ip = getRequestIp(req);
  const mail = sp.get("email");
  const installDomain = sp.get("domain");
  const fraud = detectBasicLeadFraud({
    partnerWebsiteDomain: link.partner.websiteDomain,
    clickIp: ip,
    accountEmail: mail,
    installationDomain: installDomain,
  });

  const lead = await prisma.lead.create({
    data: {
      partnerId: link.partnerId,
      referralLinkId: link.id,
      cookieId: cryptoRandomCookieId(),
      email: mail || null,
      emailDomain: emailDomain(mail) ?? null,
      installationDomain: normalizeDomain(installDomain) ?? null,
      utmSource: sp.get("utm_source") ?? null,
      utmMedium: sp.get("utm_medium") ?? null,
      utmCampaign: sp.get("utm_campaign") ?? null,
      utmTerm: sp.get("utm_term") ?? null,
      utmContent: sp.get("utm_content") ?? null,
      landingUrl: sp.get("landing") ?? null,
      sourceUrl: sp.get("source") ?? null,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
      fraudScore: fraud.score,
      fraudFlags: fraud.flags.length ? fraud.flags : undefined,
      fraudReason: fraud.reason ?? null,
      status: fraud.score >= 80 ? "DISQUALIFIED" : "CLICKED",
    },
  });

  const cookie = buildAttributionCookie({
    leadId: lead.id,
    partnerSlug: link.partner.slug,
    referralCode: link.code,
    utmSource: lead.utmSource ?? undefined,
    utmMedium: lead.utmMedium ?? undefined,
    utmCampaign: lead.utmCampaign ?? undefined,
    utmTerm: lead.utmTerm ?? undefined,
    utmContent: lead.utmContent ?? undefined,
  });

  const target = sp.get("target") || link.targetUrl || "/";
  const wantsJson = sp.get("format") === "json";
  const response = wantsJson
    ? NextResponse.json({ ok: true, leadId: lead.id, partner: link.partner.slug, referralCode: link.code, target })
    : NextResponse.redirect(new URL(target, req.nextUrl.origin));

  const ttlDays = link.commissionPlan?.cookieTtlDays ?? 30;
  response.cookies.set("pp_attr", cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    maxAge: Math.max(1, ttlDays) * 24 * 60 * 60,
    path: "/",
  });
  return response;
}

function cryptoRandomCookieId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
