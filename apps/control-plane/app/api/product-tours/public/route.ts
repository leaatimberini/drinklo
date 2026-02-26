import { NextRequest, NextResponse } from "next/server";
import { loadProductToursForRuntime } from "../../../lib/product-tours";
import { prisma } from "../../../lib/prisma";

function parseFeatureUsage(raw: string | null) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const surface = String(sp.get("surface") ?? "").toUpperCase();
  if (!["ADMIN", "STOREFRONT"].includes(surface)) {
    return NextResponse.json({ error: "surface required" }, { status: 400 });
  }
  const payload = await loadProductToursForRuntime(prisma as any, {
    surface: surface as "ADMIN" | "STOREFRONT",
    locale: sp.get("locale"),
    role: sp.get("role"),
    icp: sp.get("icp"),
    path: sp.get("path"),
    instanceId: sp.get("instanceId"),
    trialDaysRemaining: sp.get("trialDaysRemaining") != null ? Number(sp.get("trialDaysRemaining")) : null,
    featureUsage: parseFeatureUsage(sp.get("featureUsage")),
    seenTourKeys: (sp.get("seen") ?? "").split(",").map((v) => v.trim()).filter(Boolean),
    completedTourKeys: (sp.get("completed") ?? "").split(",").map((v) => v.trim()).filter(Boolean),
  });
  return NextResponse.json({ generatedAt: new Date().toISOString(), tours: payload });
}

