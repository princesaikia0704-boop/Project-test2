"use client";

import React, { useState } from "react";
import { Briefcase, LogIn, Check, Shield, Users, User } from "lucide-react";
import { useSearchParams } from "next/navigation";

const personas = [
  {
    id: "user-alice-emp",
    name: "Alice Engineer",
    firstName: "Alice",
    role: "EMPLOYEE" as const,
    dept: "Engineering",
    badge: "EMP",
    badgeBg: "bg-sky-100 text-sky-700 border-sky-200",
    cardBorder: "border-slate-200 hover:border-sky-400",
    cardBg: "hover:bg-sky-50/40",
    btnBg: "bg-sky-600 hover:bg-sky-700",
    icon: <User className="w-4 h-4" />,
    description: "Browse catalog, place orders against the Engineering budget, track your order history.",
    targetPath: "/",
  },
  {
    id: "user-carol-mgr",
    name: "Carol Manager",
    firstName: "Carol",
    role: "MANAGER" as const,
    dept: "Engineering",
    badge: "MGR",
    badgeBg: "bg-amber-100 text-amber-700 border-amber-200",
    cardBorder: "border-slate-200 hover:border-amber-400",
    cardBg: "hover:bg-amber-50/40",
    btnBg: "bg-amber-500 hover:bg-amber-600",
    icon: <Users className="w-4 h-4" />,
    description: "Approve or reject purchase orders above \$100. View department-wide order history.",
    targetPath: "/admin/approvals",
  },
  {
    id: "user-dave-adm",
    name: "Dave Administrator",
    firstName: "Dave",
    role: "ADMIN" as const,
    dept: "Operations",
    badge: "ADM",
    badgeBg: "bg-purple-100 text-purple-700 border-purple-200",
    cardBorder: "border-slate-200 hover:border-purple-400",
    cardBg: "hover:bg-purple-50/40",
    btnBg: "bg-purple-700 hover:bg-purple-800",
    icon: <Shield className="w-4 h-4" />,
    description: "Full system access — manage catalog, budgets, store settings, and audit logs.",
    targetPath: "/admin",
  },
];

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url");

  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSignIn() {
    if (!selected || loading) return;
    const persona = personas.find((p) => p.id === selected);
    if (!persona) return;

    setLoading(true);
    document.cookie = `mock_persona=${persona.id}; path=/; max-age=86400`;
    document.cookie = `mock_user_role=${persona.role}; path=/; max-age=86400`;
    document.cookie = `mock_token=mock_jwt_${persona.role.toLowerCase()}_${persona.id}; path=/; max-age=86400`;
    localStorage.setItem("active_persona", JSON.stringify(persona));

    // Honour redirect_url from middleware, else go to role's default path
    window.location.href = redirectUrl || persona.targetPath;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-4">

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8 py-7 text-center space-y-2">
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mx-auto text-white mb-3">
            <Briefcase className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black text-slate-900">Corporate Office Store</h1>
          <p className="text-sm text-slate-500">
            Select your account to sign in
          </p>
          <p className="text-[11px] text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 inline-block">
            🔐 Demo mode — Clerk SSO replaces this in production
          </p>
        </div>

        {/* Persona cards */}
        <div className="space-y-2.5">
          {personas.map((p) => {
            const isSelected = selected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={`w-full text-left rounded-xl border-2 p-4 transition-all bg-white ${p.cardBorder} ${p.cardBg} ${
                  isSelected ? "ring-2 ring-offset-1 ring-indigo-400 border-indigo-300" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${p.badgeBg}`}>
                    {p.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-sm text-slate-900">{p.name}</span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${p.badgeBg}`}>
                        {p.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-1">Dept: {p.dept}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{p.description}</p>
                  </div>

                  {/* Check */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                    isSelected ? "bg-indigo-600 border-indigo-600" : "border-slate-300"
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Sign In button */}
        <button
          type="button"
          onClick={handleSignIn}
          disabled={!selected || loading}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all ${
            selected && !loading
              ? "bg-slate-900 hover:bg-slate-700 shadow-md"
              : "bg-slate-300 cursor-not-allowed"
          }`}
        >
          <LogIn className="w-4 h-4" />
          {loading
            ? "Signing in…"
            : selected
            ? `Sign in as ${personas.find((p) => p.id === selected)?.firstName}`
            : "Select an account above"}
        </button>
      </div>
    </div>
  );
}
