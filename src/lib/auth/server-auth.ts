/**
 * Server-Side Zero-Trust Authentication Resolver (Node.js Runtime).
 * Independently verifies either Clerk JWT sessions or signed HttpOnly session cookies
 * inside API routes and Server Components (Defense-in-Depth against middleware bypass).
 */

import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema, mockDataStore } from "@/lib/db";
import { isClerkConfigured, isDatabaseMocked, isDemoAuthEnabled } from "@/lib/mock/utils";
import {
  SESSION_COOKIE_NAME,
  UserRole,
  verifySessionToken,
} from "./session";
import { logSecurityEvent } from "@/lib/security/logger";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  departmentId: string;
  email: string;
  name: string;
  authProvider: "clerk" | "session" | "demo";
}

const DEFAULT_DEPARTMENT_UUID = "10000000-0000-0000-0000-000000000001";

export const DEMO_PERSONAS: Record<
  string,
  { id: string; role: UserRole; departmentId: string; name: string; email: string }
> = {
  "user-alice-emp": {
    id: "30000000-0000-0000-0000-000000000001",
    role: "EMPLOYEE",
    departmentId: "10000000-0000-0000-0000-000000000001",
    name: "Alice Engineer",
    email: "alice@company.com",
  },
  "user-bob-emp": {
    id: "30000000-0000-0000-0000-000000000004",
    role: "EMPLOYEE",
    departmentId: "10000000-0000-0000-0000-000000000001",
    name: "Bob Staff Engineer",
    email: "bob@company.com",
  },
  "user-carol-mgr": {
    id: "30000000-0000-0000-0000-000000000002",
    role: "MANAGER",
    departmentId: "10000000-0000-0000-0000-000000000001",
    name: "Carol Manager",
    email: "carol@company.com",
  },
  "user-dave-adm": {
    id: "30000000-0000-0000-0000-000000000003",
    role: "ADMIN",
    departmentId: "10000000-0000-0000-0000-000000000005",
    name: "Dave Administrator",
    email: "dave@company.com",
  },
};

async function resolveClerkAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  try {
    const { auth, currentUser } = await import("@clerk/nextjs/server");
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return null;

    if (isDatabaseMocked()) {
      const clerkUser = await currentUser();
      const email =
        clerkUser?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ||
        `${clerkUserId}@clerk.local`;
      const existing = mockDataStore.findUserByEmail(email);
      if (existing) {
        return {
          id: existing.id,
          role: existing.role,
          departmentId: existing.departmentId || DEFAULT_DEPARTMENT_UUID,
          email: existing.email,
          name: existing.name,
          authProvider: "clerk",
        };
      }
      return {
        id: clerkUserId,
        role: "EMPLOYEE",
        departmentId: DEFAULT_DEPARTMENT_UUID,
        email,
        name: clerkUser?.fullName || clerkUser?.firstName || "Employee",
        authProvider: "clerk",
      };
    }

    // Look up user in live PostgreSQL by clerkId (never select passwordHash)
    const rows = await db
      .select({
        id: schema.users.id,
        role: schema.users.role,
        departmentId: schema.users.departmentId,
        email: schema.users.email,
        name: schema.users.name,
      })
      .from(schema.users)
      .where(eq(schema.users.clerkId, clerkUserId))
      .limit(1);

    if (rows.length > 0) {
      const u = rows[0];
      return {
        id: u.id,
        role: u.role,
        departmentId: u.departmentId || DEFAULT_DEPARTMENT_UUID,
        email: u.email,
        name: u.name,
        authProvider: "clerk",
      };
    }

    // Auto-provision verified Clerk user with least-privilege EMPLOYEE role
    const clerkUser = await currentUser();
    const email =
      clerkUser?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ||
      `${clerkUserId}@clerk.local`;
    const name = clerkUser?.fullName || clerkUser?.firstName || email.split("@")[0];

    const byEmail = await db
      .select({
        id: schema.users.id,
        role: schema.users.role,
        departmentId: schema.users.departmentId,
        email: schema.users.email,
        name: schema.users.name,
      })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (byEmail.length > 0) {
      await db
        .update(schema.users)
        .set({ clerkId: clerkUserId, updatedAt: new Date() })
        .where(eq(schema.users.id, byEmail[0].id));
      return {
        id: byEmail[0].id,
        role: byEmail[0].role,
        departmentId: byEmail[0].departmentId || DEFAULT_DEPARTMENT_UUID,
        email: byEmail[0].email,
        name: byEmail[0].name,
        authProvider: "clerk",
      };
    }

    const [created] = await db
      .insert(schema.users)
      .values({
        clerkId: clerkUserId,
        email,
        name,
        role: "EMPLOYEE",
        departmentId: DEFAULT_DEPARTMENT_UUID,
      })
      .returning({
        id: schema.users.id,
        role: schema.users.role,
        departmentId: schema.users.departmentId,
        email: schema.users.email,
        name: schema.users.name,
      });

    return {
      id: created.id,
      role: created.role,
      departmentId: created.departmentId || DEFAULT_DEPARTMENT_UUID,
      email: created.email,
      name: created.name,
      authProvider: "clerk",
    };
  } catch (err: any) {
    logSecurityEvent({
      event: "AUTH_SESSION_INVALID",
      severity: "WARN",
      reason: err?.message || "Clerk session lookup failed",
    });
    return null;
  }
}

/**
 * Resolves the authoritative authenticated user for an incoming API request.
 * Never trusts x-user-id, x-user-role, x-department-id, or client mock_* cookies.
 */
export async function resolveServerSession(
  req: NextRequest
): Promise<AuthenticatedUser | null> {
  // 1. Clerk JWT verification when Clerk is configured
  if (isClerkConfigured()) {
    const clerkSession = await resolveClerkAuthenticatedUser();
    if (clerkSession) return clerkSession;
  }

  // 2. Signed HttpOnly session cookie (issued by /api/auth/login, /register, or /demo-session)
  const rawToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const payload = await verifySessionToken(rawToken);
  if (!payload) {
    return null;
  }

  // Strictly disallow demo session tokens when demo auth is disabled (e.g. production)
  if (payload.demo) {
    if (!isDemoAuthEnabled()) {
      logSecurityEvent({
        event: "PRIVILEGE_ESCALATION_ATTEMPT",
        severity: "HIGH",
        userId: payload.sub,
        role: payload.role,
        path: req.nextUrl?.pathname,
        method: req.method,
        reason: "Demo session token presented while demo auth is disabled",
      });
      return null;
    }
    return {
      id: payload.sub,
      role: payload.role,
      departmentId: payload.dept || DEFAULT_DEPARTMENT_UUID,
      email: payload.email,
      name: payload.name,
      authProvider: "demo",
    };
  }

  // 3. Verify live user status & sessionVersion against authoritative data store
  if (isDatabaseMocked()) {
    const mockUser = mockDataStore.findUserById(payload.sub);
    if (!mockUser) return null;
    if ((mockUser.sessionVersion ?? 1) !== payload.ver) return null;
    return {
      id: mockUser.id,
      role: mockUser.role,
      departmentId: mockUser.departmentId || DEFAULT_DEPARTMENT_UUID,
      email: mockUser.email,
      name: mockUser.name,
      authProvider: "session",
    };
  }

  const rows = await db
    .select({
      id: schema.users.id,
      role: schema.users.role,
      departmentId: schema.users.departmentId,
      email: schema.users.email,
      name: schema.users.name,
      sessionVersion: schema.users.sessionVersion,
    })
    .from(schema.users)
    .where(eq(schema.users.id, payload.sub))
    .limit(1);

  if (rows.length === 0) return null;
  const dbUser = rows[0];
  if (dbUser.sessionVersion !== payload.ver) {
    return null;
  }

  return {
    id: dbUser.id,
    role: dbUser.role,
    departmentId: dbUser.departmentId || DEFAULT_DEPARTMENT_UUID,
    email: dbUser.email,
    name: dbUser.name,
    authProvider: "session",
  };
}
