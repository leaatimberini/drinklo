import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../lib/admin-auth";
import { buildAuditPackage } from "../../../lib/compliance-evidence";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const pkg = await buildAuditPackage();
  return new NextResponse(pkg.zip, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${pkg.filename}"`,
      "x-audit-signature": pkg.signature,
    },
  });
}
