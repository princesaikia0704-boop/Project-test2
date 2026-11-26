import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, getRequestAuth } from "@/lib/http/api-handler";
import { clearSessionCookies } from "@/lib/auth/session";
import { logSecurityEvent } from "@/lib/security/logger";
import { extractTrustedClientIp } from "@/lib/security/rate-limit";

export const POST = withApiReliability(async (req: NextRequest) => {
  const authUser = await getRequestAuth(req);
  logSecurityEvent({
    event: "AUTH_LOGOUT",
    severity: "INFO",
    userId: authUser?.id ?? null,
    role: authUser?.role ?? null,
    ip: extractTrustedClientIp(req),
    path: "/api/auth/logout",
    method: "POST",
  });

  const res = NextResponse.json({ success: true }, { status: 200 });
  clearSessionCookies(res);
  return res;
});
