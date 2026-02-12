import type { NextRequest } from "next/server";
import { prisma } from "./prisma";

export async function getPublisherFromRequest(req: NextRequest) {
  const apiKey = req.headers.get("x-publisher-key")?.trim();
  if (!apiKey) {
    return null;
  }

  const publisher = await prisma.publisher.findUnique({ where: { apiKey } });
  if (!publisher) {
    return null;
  }

  return publisher;
}
