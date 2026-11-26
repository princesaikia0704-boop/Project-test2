"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import {
  Package,
  ArrowRight,
  Lock,
  Mail,
  User as UserIcon,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { sanitizeRedirectPath } from "@/lib/security/url";

type AuthTab = "signin" | "register" | "forgot" | "reset";

interface AuthStatusResponse {
  authenticated: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    role: "EMPLOYEE" | "MANAGER" | "ADMIN";
    departmentId: string;
  } | null;
  clerkEnabled: boolean;
  demoModeEnabled: boolean;
}

const DEMO_PERSONAS = [
  {
    id: "user-alice-emp",
    name: "Alice Vance",
    role: "EMPLOYEE" as const,
    department: "Engineering",
    email: "alice@company.com",
    targetPath: "/",
  },
  {
    id: "user-bob-emp",
    name: "Bob Miller",
    role: "EMPLOYEE" as const,
    department: "Marketing",
    email: "bob@company.com",
    targetPath: "/",
  },
  {
    id: "user-carol-mgr",
    name: "Carol Chen",
    role: "MANAGER" as const,
    department: "Engineering",
    email: "carol@company.com",
    targetPath: "/admin",
  },
  {
    id: "user-dave-adm",
    name: "Dave Vance",
    role: "ADMIN" as const,
    department: "Operations",
    email: "dave@company.com",
    targetPath: "/admin",
  },
];

function getDefaultTargetForRole(role?: string | null): string {
  return role === "ADMIN" || role === "MANAGER" ? "/admin" : "/";
}

function LoginContent() {
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect");
  const initialResetToken = searchParams.get("reset_token") || "";

  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [activeTab, setActiveTab] = useState<AuthTab>(initialResetToken ? "reset" : "signin");

  // Sign In fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register fields
  const [fullName, setFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // Password reset fields
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [newPassword, setNewPassword] = useState("");
  const [devResetHint, setDevResetHint] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AuthStatusResponse | null) => {
        if (!active || !data) return;
        setAuthStatus(data);
        if (data.authenticated && data.user) {
          const safeTarget = sanitizeRedirectPath(
            rawRedirect,
            getDefaultTargetForRole(data.user.role)
          );
          window.location.assign(safeTarget);
        }
      })
      .catch(() => {
        // Ignore initial status error and render default login form
      })
      .finally(() => {
        if (active) setIsLoadingStatus(false);
      });

    return () => {
      active = false;
    };
  }, [rawRedirect]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.message || "Invalid email or password.");
        return;
      }

      const target = sanitizeRedirectPath(
        rawRedirect,
        getDefaultTargetForRole(data.user?.role)
      );
      window.location.assign(target);
    } catch {
      setErrorMessage("Unable to reach authentication server. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName.trim(),
          email: regEmail.trim(),
          password: regPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.message || "Registration failed. Check password requirements.");
        return;
      }

      const target = sanitizeRedirectPath(rawRedirect, "/");
      window.location.assign(target);
    } catch {
      setErrorMessage("Unable to reach authentication server. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setDevResetHint(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.message || "Failed to request password reset.");
        return;
      }

      setSuccessMessage(
        data.message ||
          "If an account with that email exists, a single-use password reset link has been issued (expires in 30 minutes)."
      );

      if (typeof data.devResetToken === "string" && data.devResetToken.length === 64) {
        setDevResetHint(data.devResetToken);
      }
    } catch {
      setErrorMessage("Unable to process password reset request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: resetToken.trim(),
          newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.message || "Invalid or expired reset token.");
        return;
      }

      setSuccessMessage(data.message || "Password updated successfully. You may now sign in.");
      setNewPassword("");
      setResetToken("");
      setActiveTab("signin");
    } catch {
      setErrorMessage("Unable to complete password reset.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoSignIn = async (persona: (typeof DEMO_PERSONAS)[number]) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/demo-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId: persona.id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.message || "Demo sign-in is disabled.");
        return;
      }

      const target = sanitizeRedirectPath(rawRedirect, persona.targetPath);
      window.location.assign(target);
    } catch {
      setErrorMessage("Failed to start demo session.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingStatus) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-1">
            <Package className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Corporate Office Store
          </h1>
          <p className="text-xs text-slate-400">
            Authenticated Supply Portal &bull; Enterprise Access Control
          </p>
        </div>

        {/* Clerk Managed Authentication when configured */}
        {authStatus?.clerkEnabled ? (
          <div className="flex justify-center">
            <SignIn routing="hash" />
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setActiveTab("signin");
                }}
                className={`py-2 rounded-lg transition ${
                  activeTab === "signin"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setActiveTab("register");
                }}
                className={`py-2 rounded-lg transition ${
                  activeTab === "register"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setActiveTab(activeTab === "reset" ? "reset" : "forgot");
                }}
                className={`py-2 rounded-lg transition ${
                  activeTab === "forgot" || activeTab === "reset"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Reset Password
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{successMessage}</span>
                </div>
                {devResetHint && (
                  <button
                    type="button"
                    onClick={() => {
                      setResetToken(devResetHint);
                      setActiveTab("reset");
                    }}
                    className="underline text-emerald-300 hover:text-white font-semibold"
                  >
                    Development Mode: Apply Reset Token
                  </button>
                )}
              </div>
            )}

            {activeTab === "signin" && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Corporate Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {activeTab === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Work Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="jane@company.com"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Strong Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={12}
                      autoComplete="new-password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 12 chars (upper, lower, digit, symbol)"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Create Employee Account</span>
                </button>
              </form>
            )}

            {activeTab === "forgot" && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Account Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Send Reset Link</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("reset")}
                  className="w-full text-xs text-slate-400 hover:text-indigo-400 underline"
                >
                  Already have a reset token? Enter token
                </button>
              </form>
            )}

            {activeTab === "reset" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Reset Token
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="64-character single-use token"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    New Strong Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={12}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 12 chars (upper, lower, digit, symbol)"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Reset Password</span>
                </button>
              </form>
            )}
          </>
        )}

        {/* Development-only Demo Personas (explicitly gated by server demoModeEnabled flag) */}
        {authStatus?.demoModeEnabled && (
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <Sparkles className="w-4 h-4" />
              <span>Sandbox Demo Quick Sign-In (Non-Production Only)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DEMO_PERSONAS.map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDemoSignIn(persona)}
                  className="flex flex-col text-left p-3 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800 hover:border-indigo-500/40 transition disabled:opacity-50"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-bold text-white">{persona.name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                      {persona.role}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {persona.department} &bull; {persona.email}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-slate-800 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Signed HttpOnly Cookie &amp; RBAC Enforced Server-Side</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <LoginContent />
    </Suspense>
  );
}
