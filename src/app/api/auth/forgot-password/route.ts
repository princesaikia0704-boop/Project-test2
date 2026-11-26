import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { withApiReliability, createErrorResponse } from "@/lib/http/api-handler";
import { forgotPasswordSchema } from "@/lib/validators/auth.schema";
import { issuePasswordResetToken, PASSWORD_RESET_TTL_MINUTES } from "@/lib/auth/password-reset";
import { db, schema, mockDataStore } from "@/lib/db";
import { isDatabaseMocked, isServiceMocked } from "@/lib/mock/utils";
import { logSecurityEvent } from "@/lib/security/logger";
import { extractTrustedClientIp } from "@/lib/security/rate-limit";
import { classifyAuthDbError } from "@/lib/auth/db-auth-utils";

const GENERIC_SUCCESS_MESSAGE =
  "If an account with that email exists, a password reset link has been sent.";

export const POST = withApiReliability(async (req: NextRequest) => {
  const clientIp = extractTrustedClientIp(req);

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return createErrorResponse("ValidationError", "Request body must be valid JSON", 400);
  }

  const parsed = forgotPasswordSchema.safeParse(rawBody);
  if (!parsed.success) {
    return createErrorResponse(
      "ValidationError",
      parsed.error.issues[0]?.message || "Valid email address is required",
      400
    );
  }

  const { email } = parsed.data;
  let userRecord: { id: string; email: string; name: string } | null = null;

  try {
    if (isDatabaseMocked()) {
      const found = mockDataStore.findUserByEmail(email);
      if (found) userRecord = { id: found.id, email: found.email, name: found.name };
    } else {
      const rows = await db
        .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);
      userRecord = rows[0] ?? null;
    }

    logSecurityEvent({
      event: "AUTH_PASSWORD_RESET_REQUEST",
      severity: "INFO",
      userId: userRecord?.id ?? null,
      ip: clientIp,
      path: "/api/auth/forgot-password",
      method: "POST",
    });

    if (userRecord) {
      const { rawToken } = await issuePasswordResetToken(userRecord.id);
      const appOrigin =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
      const resetLink = `${appOrigin}/login?reset_token=${rawToken}`;

      if (!isServiceMocked("resend")) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY!);
          await resend.emails.send({
            from: process.env.EMAIL_FROM || "Office Store <noreply@officestore.local>",
            to: userRecord.email,
            subject: "Password Reset Request — Corporate Office Store",
            text: `Hello ${userRecord.name},\n\nUse the single-use link below to reset your password. This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes:\n\n${resetLink}\n\nIf you did not request a password reset, ignore this email.`,
          });
        } catch (emailErr: any) {
          logSecurityEvent({
            event: "UNHANDLED_SERVER_ERROR",
            severity: "HIGH",
            userId: userRecord.id,
            ip: clientIp,
            path: "/api/auth/forgot-password",
            reason: emailErr?.message || "Failed to dispatch reset email",
          });
        }
      }
      // Never return rawToken in HTTP responses or log it in production
    }
  } catch (err) {
    const classified = classifyAuthDbError(err, {
      path: "/api/auth/forgot-password",
      method: "POST",
      ip: clientIp,
      userId: userRecord?.id ?? null,
    });
    if (classified) {
      return createErrorResponse(classified.error, classified.message, classified.statusCode);
    }
    throw err;
  }

  return NextResponse.json(
    {
      success: true,
      message: GENERIC_SUCCESS_MESSAGE,
    },
    { status: 200 }
  );
});
