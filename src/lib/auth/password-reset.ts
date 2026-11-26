/**
 * Cryptographic Password Reset Token Lifecycle (Node.js Runtime).
 * - Generates 256-bit cryptographically random tokens (randomBytes(32))
 * - Stores ONLY SHA-256 hash in database (never plaintext)
 * - Strictly single-use and expires after 30 minutes (within 15-60 min OWASP guideline)
 * - Invalidates all existing user sessions upon password reset
 */

import crypto from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { txDb, schema, mockDataStore } from "@/lib/db";
import { isDatabaseMocked } from "@/lib/mock/utils";

export const PASSWORD_RESET_TTL_MINUTES = 30;
export const PASSWORD_RESET_TTL_MS = PASSWORD_RESET_TTL_MINUTES * 60 * 1000;

export function hashResetToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export interface GeneratedResetToken {
  rawToken: string;
  expiresAt: Date;
}

/**
 * Issues a cryptographically random password reset token for a user,
 * revoking any prior unused tokens for that account.
 */
export async function issuePasswordResetToken(userId: string): Promise<GeneratedResetToken> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  if (isDatabaseMocked()) {
    mockDataStore.createPasswordResetToken(userId, tokenHash, expiresAt);
    return { rawToken, expiresAt };
  }

  await txDb.transaction(async (tx) => {
    // Revoke any unconsumed reset tokens for this user
    await tx
      .update(schema.passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(schema.passwordResetTokens.userId, userId),
          isNull(schema.passwordResetTokens.usedAt)
        )
      );

    await tx.insert(schema.passwordResetTokens).values({
      userId,
      tokenHash,
      expiresAt,
      usedAt: null,
    });
  });

  return { rawToken, expiresAt };
}

/**
 * Atomically verifies a single-use, non-expired password reset token, marks it used,
 * updates the user's bcrypt password hash, and increments sessionVersion to revoke
 * all previously active sessions.
 */
export async function consumePasswordResetToken(
  rawToken: string,
  newPasswordHash: string
): Promise<{ ok: true; userId: string } | { ok: false }> {
  if (!rawToken || !/^[0-9a-f]{64}$/i.test(rawToken.trim())) {
    return { ok: false };
  }

  const tokenHash = hashResetToken(rawToken.trim());

  if (isDatabaseMocked()) {
    const res = mockDataStore.consumePasswordResetToken(tokenHash, newPasswordHash);
    return res ? { ok: true, userId: res.userId } : { ok: false };
  }

  const result = await txDb.transaction(async (tx) => {
    const now = new Date();
    const consumed = await tx
      .update(schema.passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(schema.passwordResetTokens.tokenHash, tokenHash),
          isNull(schema.passwordResetTokens.usedAt),
          gt(schema.passwordResetTokens.expiresAt, now)
        )
      )
      .returning({ userId: schema.passwordResetTokens.userId });

    if (!consumed || consumed.length === 0) {
      return null;
    }

    const userId = consumed[0].userId;
    await tx
      .update(schema.users)
      .set({
        passwordHash: newPasswordHash,
        sessionVersion: sql`${schema.users.sessionVersion} + 1`,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: now,
      })
      .where(eq(schema.users.id, userId));

    return userId;
  });

  return result ? { ok: true, userId: result } : { ok: false };
}
