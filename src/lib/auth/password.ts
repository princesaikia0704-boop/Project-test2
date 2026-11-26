/**
 * Password Hashing & Verification Service (Node.js Runtime).
 * Enforces bcrypt with cost factor >= 12 (OWASP ASVS compliant) and strong password validation.
 */

import bcrypt from "bcryptjs";
import { z } from "zod";

export const BCRYPT_COST_FACTOR = 12;

export const strongPasswordSchema = z
  .string({ required_error: "Password is required" })
  .min(12, "Password must be at least 12 characters long")
  .max(72, "Password must not exceed 72 characters")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one digit")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

// Dummy valid bcrypt cost-12 hash used for constant-time comparison when user email is not found
const DUMMY_BCRYPT_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKxGhu6D6W2nA5k1uQ8kN8mG7sR8cK5zW3y1O";

/**
 * Hashes a plaintext password using bcrypt with cost factor 12.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  if (!plainPassword || plainPassword.length > 72) {
    throw new Error("Invalid password length for bcrypt hashing");
  }
  return await bcrypt.hash(plainPassword, BCRYPT_COST_FACTOR);
}

/**
 * Constant-time bcrypt verification. Runs dummy hash compare when hash is null
 * to prevent timing-based user enumeration.
 */
export async function verifyPassword(
  plainPassword: string,
  storedHash: string | null | undefined
): Promise<boolean> {
  if (!plainPassword || plainPassword.length > 72) {
    return false;
  }
  if (!storedHash) {
    await bcrypt.compare(plainPassword, DUMMY_BCRYPT_HASH);
    return false;
  }
  return await bcrypt.compare(plainPassword, storedHash);
}
