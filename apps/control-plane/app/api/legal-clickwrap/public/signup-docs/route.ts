import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getLatestLegalDocuments, SIGNUP_REQUIRED_DOC_TYPES } from "../../../../lib/legal-clickwrap";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale") ?? "es";
  const docs = await getLatestLegalDocuments(prisma as any, {
    types: SIGNUP_REQUIRED_DOC_TYPES,
    locale,
  });

  return NextResponse.json({
    locale,
    documents: SIGNUP_REQUIRED_DOC_TYPES.map((type) => {
      const doc = docs.get(type);
      return doc
        ? {
            type: doc.type,
            version: doc.version,
            locale: doc.locale,
            title: doc.title,
            effectiveAt: doc.effectiveAt,
            content: doc.content,
          }
        : null;
    }).filter(Boolean),
  });
}

