import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { isAdminRequest } from "../../../lib/admin-auth";
import { normalizeHostLike } from "../../../lib/trial-campaigns";

function parseOptionalDate(value: unknown) {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item) => normalizeHostLike(typeof item === "string" ? item : ""))
    .filter((item): item is string => Boolean(item));
}

export async function PATCH(req: NextRequest, ctx: any) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = String(ctx?.params?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const body = await req.json().catch(() => ({}));

  const data: any = {
    updatedBy: body.actor ? String(body.actor) : "admin",
  };
  if (body.durationDays != null) {
    const durationDays = Number(body.durationDays);
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 120) {
      return NextResponse.json({ error: "durationDays must be between 1 and 120" }, { status: 400 });
    }
    data.durationDays = durationDays;
  }
  if (body.maxRedemptions !== undefined) {
    data.maxRedemptions = body.maxRedemptions == null || body.maxRedemptions === "" ? null : Number(body.maxRedemptions);
  }
  if (body.expiresAt !== undefined) {
    data.expiresAt = parseOptionalDate(body.expiresAt);
  }
  if (body.requiresApproval !== undefined) {
    data.requiresApproval = Boolean(body.requiresApproval);
  }
  if (body.allowedDomains !== undefined) {
    data.allowedDomains = parseStringArray(body.allowedDomains) ?? [];
  }
  if (body.blockedDomains !== undefined) {
    data.blockedDomains = parseStringArray(body.blockedDomains) ?? [];
  }
  if (body.notes !== undefined) {
    data.notes = body.notes == null ? null : String(body.notes);
  }
  if (body.status !== undefined) {
    const status = String(body.status).toUpperCase();
    if (status !== "ACTIVE" && status !== "REVOKED") {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    data.status = status;
    data.revokedAt = status === "REVOKED" ? new Date() : null;
  }

  const updated = await prisma.trialCampaign.update({
    where: { id },
    data,
  });
  return NextResponse.json(updated);
}

