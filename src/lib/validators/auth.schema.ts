/**
 * Corporate Office Store - Authentication & Password Reset Validation Schemas
 */

import { z } from "zod";
import { strongPasswordSchema } from "@/lib/auth/password";

export const emailSchema = z
  .string({ required_error: "Email is required" })
  .trim()
  .toLowerCase()
  .email("Valid email address is required")
  .max(255);

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password is required")
    .max(72, "Invalid password"),
});

export const registerSchema = z.object({
  name: z
    .string({ required_error: "Full name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name is too long"),
  email: emailSchema,
  password: strongPasswordSchema,
  departmentSlug: z.string().trim().max(50).optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z
    .string({ required_error: "Reset token is required" })
    .trim()
    .regex(/^[0-9a-f]{64}$/i, "Invalid or malformed password reset token"),
  newPassword: strongPasswordSchema,
});

export const demoSessionSchema = z.object({
  personaId: z.enum([
    "user-alice-emp",
    "user-bob-emp",
    "user-carol-mgr",
    "user-dave-adm",
  ]),
});
