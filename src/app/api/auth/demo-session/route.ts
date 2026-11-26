import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse } from "@/lib/http/api-handler";
import { demoSessionSchema } from "@/lib/validators/auth.schema";
import { DEMO_PERSONAS } from "@/lib/auth/server-auth";
import { attachSessionCookie, signSessionToken } from "@/lib/auth/session";
import { isDemoAuthEnabled } from "@/lib/mock/utils";
import { logSecurityEvent } from "@/lib/security/logger";
import { extractTrustedClientIp } from "@/lib/security/rate-limit";

export const POST = withApiReliability(async (req: NextRequest) => {
  const clientIp = extractTrustedClientIp(req);

  if (!isDemoAuthEnabled()) {
    logSecurityEvent({
      event: "PRIVILEGE_ESCALATION_ATTEMPT",
      severity: "CRITICAL",
      ip: clientIp,
      path: "/api/auth/demo-session",
      method: "POST",
      reason: "Attempted demo persona login while demo mode is disabled",
    });
    return createErrorResponse(
      "Forbidden",
      "Demo authentication is disabled in this environment.",
      403
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return createErrorResponse("ValidationError", "Request body must be valid JSON", 400);
  }

  const parsed = demoSessionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return createErrorResponse("ValidationError", "Invalid demo persona selected", 400);
  }

  const persona = DEMO_PERSONAS[parsed.data.personaId];
  const token = await signSessionToken({
    sub: persona.id,
    role: persona.role,
    dept: persona.departmentId,
    email: persona.email,
    name: persona.name,
    ver: 1,
    demo: true,
  });

  logSecurityEvent({
    event: "AUTH_DEMO_SESSION",
    severity: "INFO",
    userId: persona.id,
    role: persona.role,
    ip: clientIp,
    path: "/api/auth/demo-session",
    method: "POST",
  });

  const res = NextResponse.json(
    {
      success: true,
      user: {
        id: persona.id,
        name: persona.name,
        email: persona.email,
        role: persona.role,
        departmentId: persona.departmentId,
      },
    },
    { status: 200 }
  );
  attachSessionCookie(res, token);
  return res;
});
