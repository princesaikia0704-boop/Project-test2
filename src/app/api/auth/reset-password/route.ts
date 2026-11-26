import { NextRequest, NextResponse } from "next/server";
import { withApiReliability, createErrorResponse } from "@/lib/http/api-handler";
import { resetPasswordSchema } from "@/lib/validators/auth.schema";
import { hashPassword } from "@/lib/auth/password";
import { consumePasswordResetToken } from "@/lib/auth/password-reset";
import { clearSessionCookies } from "@/lib/auth/session";
import { logSecurityEvent } from "@/lib/security/logger";
import { extractTrustedClientIp } from "@/lib/security/rate-limit";

export const POST = withApiReliability(async (req: NextRequest) => {
  const clientIp = extractTrustedClientIp(req);

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return createErrorResponse("ValidationError", "Request body must be valid JSON", 400);
  }

  const parsed = resetPasswordSchema.safeParse(rawBody);
  if (!parsed.success) {
    logSecurityEvent({
      event: "AUTH_PASSWORD_RESET_INVALID",
      severity: "WARN",
      ip: clientIp,
      path: "/api/auth/reset-password",
      method: "POST",
      reason: parsed.error.issues[0]?.message || "Malformed reset request",
    });
    return createErrorResponse(
      "ValidationError",
      parsed.error.issues[0]?.message || "Invalid reset token or weak password",
      400
    );
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  const consumed = await consumePasswordResetToken(parsed.data.token, newHash);

  if (!consumed.ok) {
    logSecurityEvent({
      event: "AUTH_PASSWORD_RESET_INVALID",
      severity: "WARN",
      ip: clientIp,
      path: "/api/auth/reset-password",
      method: "POST",
      reason: "Expired, already used, or nonexistent reset token",
    });
    return createErrorResponse(
      "InvalidOrExpiredToken",
      "Password reset link is invalid, expired, or has already been used.",
      400
    );
  }

  logSecurityEvent({
    event: "AUTH_PASSWORD_RESET_SUCCESS",
    severity: "INFO",
    userId: consumed.userId,
    ip: clientIp,
    path: "/api/auth/reset-password",
    method: "POST",
  });

  const res = NextResponse.json(
    {
      success: true,
      message: "Password updated successfully. Please sign in with your new password.",
    },
    { status: 200 }
  );
  clearSessionCookies(res);
  return res;
});
