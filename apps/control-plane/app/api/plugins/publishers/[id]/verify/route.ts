import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { isAdminRequest } from "../../../../../lib/admin-auth";

export async function POST(req: NextRequest, ctx: any) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = ctx?.params?.id as string;

  const body = await req.json().catch(() => ({}));
  const verified = body.verified !== false;
  const notes = body.notes ? String(body.notes) : null;

  const publisher = await prisma.publisher.findUnique({ where: { id } });
  if (!publisher) {
    return NextResponse.json({ error: "publisher not found" }, { status: 404 });
  }

  const updated = await prisma.publisher.update({
    where: { id },
    data: {
      verificationStatus: verified ? "VERIFIED" : "REJECTED",
      verificationNotes: notes,
      verifiedAt: verified ? new Date() : null,
    },
  });

  return NextResponse.json({
    id: updated.id,
    verificationStatus: updated.verificationStatus,
    verifiedAt: updated.verifiedAt,
  });
}
