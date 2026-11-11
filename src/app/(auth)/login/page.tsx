"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [, setActivePersona] = useState<string | null>(null);

  const personas = [
    {
      id: "user-alice-emp",
      name: "Alice Engineer",
      role: "EMPLOYEE",
      dept: "Engineering (dept-eng)",
      badge: "Employee",
      color: "border-sky-200 hover:border-sky-500 bg-sky-50/30",
      description: "Browse catalog, checkout against Engineering budget ($1,000), track personal orders.",
      targetPath: "/",
    },
    {
      id: "user-carol-mgr",
      name: "Carol Manager",
      role: "MANAGER",
      dept: "Engineering (dept-eng)",
      badge: "Manager / Approver",
      color: "border-amber-200 hover:border-amber-500 bg-amber-50/30",
      description: "Review pending purchase orders exceeding $100, approve or reject with audit comments.",
      targetPath: "/admin/approvals",
    },
    {
      id: "user-dave-adm",
      name: "Dave Administrator",
      role: "ADMIN",
      dept: "Operations (dept-ops)",
      badge: "System Admin",
      color: "border-purple-200 hover:border-purple-500 bg-purple-50/30",
      description: "Full management access: Product catalog CRUD, stock adjustment, department budgets, audit logs.",
      targetPath: "/admin",
    },
  ];

  const handleSelectPersona = (persona: (typeof personas)[0]) => {
    setActivePersona(persona.id);
    document.cookie = `mock_persona=${persona.id}; path=/; max-age=86400`;
    document.cookie = `mock_user_role=${persona.role}; path=/; max-age=86400`;
    document.cookie = `mock_token=mock_jwt_${persona.role.toLowerCase()}_${persona.id}; path=/; max-age=86400`;

    localStorage.setItem("active_persona", JSON.stringify(persona));
    router.push(persona.targetPath);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-3 text-white">
            <Briefcase className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black text-slate-900">Corporate Office Store</h1>
          <p className="text-xs text-slate-500">
            Sign in with test personas to experience role-based budgets, workflows, and catalog management.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            ⚡ Quick-Switch Demo Personas
          </h2>

          <div className="grid gap-3">
            {personas.map((p) => (
              <div
                key={p.id}
                onClick={() => handleSelectPersona(p)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${p.color}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{p.name}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                      {p.badge}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
                <p className="text-xs text-slate-500 mb-2 leading-relaxed">{p.description}</p>
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>Department: {p.dept}</span>
                  <span className="font-semibold text-slate-700">Login as {p.name.split(" ")[0]} →</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
          In production, Clerk SSO handles credential verification.
        </div>
      </div>
    </div>
  );
}
