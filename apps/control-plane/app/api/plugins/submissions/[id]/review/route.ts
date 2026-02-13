import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { isAdminRequest } from "../../../../../lib/admin-auth";

export async function POST(req: NextRequest, ctx: any) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = ctx?.params?.id as string;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "").trim().toLowerCase();
  const reason = body.reason ? String(body.reason) : null;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }

  const submission = await prisma.pluginSubmission.findUnique({
    where: { id },
    include: { publisher: true },
  });

  if (!submission) {
    return NextResponse.json({ error: "submission not found" }, { status: 404 });
  }

  if (submission.status === "APPROVED" || submission.status === "REJECTED") {
    return NextResponse.json({ error: `submission already ${submission.status.toLowerCase()}` }, { status: 409 });
  }

  if (action === "reject") {
    const updated = await prisma.pluginSubmission.update({
      where: { id: submission.id },
      data: {
        status: "REJECTED",
        reviewedBy: "admin",
        reviewedAt: new Date(),
        reviewReport: {
          ...(submission.reviewReport as any),
          manualReview: {
            action: "reject",
            reason: reason ?? "Rejected by reviewer",
          },
        },
      },
    });
    return NextResponse.json({ id: updated.id, status: updated.status });
  }

  const release = await prisma.pluginRelease.create({
    data: {
      publisherId: submission.publisherId,
      sourceSubmissionId: submission.id,
      name: submission.pluginName,
      version: submission.version,
      channel: submission.channel,
      compatibility: submission.compatibility,
      changelog: submission.changelog,
      signature: submission.signature,
      permissions: submission.requestedPermissions,
      dependencies: submission.dependencies,
      reviewStatus: "approved",
    },
  });

  const updated = await prisma.pluginSubmission.update({
    where: { id: submission.id },
    data: {
      status: "APPROVED",
      reviewedBy: "admin",
      reviewedAt: new Date(),
      reviewReport: {
        ...(submission.reviewReport as any),
        manualReview: {
          action: "approve",
          reason: reason ?? null,
          releaseId: release.id,
        },
      },
    },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    releaseId: release.id,
  });
}
