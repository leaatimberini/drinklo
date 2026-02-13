"use server";

import { cookies } from "next/headers";
import { getTokenForRole, type Role } from "../lib/auth";

export async function setCookie(role: string, token: string) {
  const cookieJar = await cookies();
  const expected = getTokenForRole(role as Role);
  if (!expected || expected !== token) {
    throw new Error("Invalid token");
  }
  cookieJar.set("cp_role", role, { httpOnly: true, sameSite: "lax" });
  cookieJar.set("cp_token", token, { httpOnly: true, sameSite: "lax" });
}
