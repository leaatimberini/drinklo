import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { isAdminRequest } from "../../../lib/admin-auth";
import { getPublisherFromRequest } from "../../../lib/publisher-auth";
import { runPluginReview } from "../../../lib/plugin-review";
import { verifyPublisherBundleSignature } from "../../../lib/plugin-marketplace";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const submissions = await prisma.pluginSubmission.findMany({
    where: status ? { status } : undefined,
    include: {
      publisher: {
        select: {
          id: true,
          name: true,
          email: true,
          verificationStatus: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(submissions);
}

export async function POST(req: NextRequest) {
  const admin = isAdminRequest(req);
  const publisherFromHeader = admin ? null : await getPublisherFromRequest(req);
  if (!admin && !publisherFromHeader) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const publisherId = admin
    ? String(body.publisherId ?? "").trim()
    : String(publisherFromHeader?.id ?? "");
  const pluginName = String(body.pluginName ?? "").trim();
  const version = String(body.version ?? "").trim();
  const channel = String(body.channel ?? "stable").trim() || "stable";
  const bundleUrl = String(body.bundleUrl ?? "").trim();
  const manifest = body.manifest && typeof body.manifest === "object" ? body.manifest : {};
  const signature = String(body.signature ?? "").trim();
  const requestedPermissions = Array.isArray(body.requestedPermissions)
    ? body.requestedPermissions.map((x: any) => String(x))
    : [];
  const dependencies = Array.isArray(body.dependencies)
    ? body.dependencies.map((x: any) => String(x))
    : [];

  if (!publisherId || !pluginName || !version || !bundleUrl || !signature) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const publisher = await prisma.publisher.findUnique({ where: { id: publisherId } });
  if (!publisher) {
    return NextResponse.json({ error: "publisher not found" }, { status: 404 });
  }

  if (publisher.verificationStatus !== "VERIFIED") {
    return NextResponse.json({ error: "publisher not verified" }, { status: 403 });
  }

  const signedPayload = {
    pluginName,
    version,
    channel,
    bundleUrl,
    manifest,
    requestedPermissions,
    dependencies,
  };

  if (!verifyPublisherBundleSignature(signedPayload, signature, publisher.signingSecret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const reviewReport = runPluginReview({
    pluginName,
    version,
    channel,
    bundleUrl,
    manifest,
    requestedPermissions,
    dependencies,
  });

  const status = reviewReport.decision === "REJECT" ? "REJECTED_POLICY" : "UNDER_REVIEW";

  const submission = await prisma.pluginSubmission.create({
    data: {
      publisherId,
      pluginName,
      version,
      channel,
      compatibility: body.compatibility ?? null,
      changelog: body.changelog ?? null,
      bundleUrl,
      manifest,
      signature,
      requestedPermissions,
      dependencies,
      revenueShareBps:
        body.revenueShareBps == null
          ? publisher.defaultRevenueShareBps
          : Number(body.revenueShareBps),
      status,
      reviewReport,
      reviewedAt: status === "REJECTED_POLICY" ? new Date() : null,
      reviewedBy: status === "REJECTED_POLICY" ? "policy-gate" : null,
    },
  });

  return NextResponse.json({
    id: submission.id,
    status: submission.status,
    reviewReport,
  });
}
