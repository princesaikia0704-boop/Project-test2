"use client";

import React, { useEffect, useRef, useState } from "react";
import { Users, Check, ChevronDown, LogOut } from "lucide-react";

export type Persona = {
  id: string;
  name: string;
  shortName: string;
  role: string;
  badge: string;
  badgeBg: string;    // tailwind classes for badge background + text
  targetPath: string;
};

export const PERSONAS: Persona[] = [
  {
    id: "user-alice-emp",
    name: "Alice Engineer",
    shortName: "Alice",
    role: "EMPLOYEE",
    badge: "EMP",
    badgeBg: "bg-slate-200 text-slate-700",
    targetPath: "/",
  },
  {
    id: "user-carol-mgr",
    name: "Carol Manager",
    shortName: "Carol",
    role: "MANAGER",
    badge: "MGR",
    badgeBg: "bg-amber-200 text-amber-700",
    targetPath: "/admin/approvals",
  },
  {
    id: "user-dave-adm",
    name: "Dave Admin",
    shortName: "Dave",
    role: "ADMIN",
    badge: "ADM",
    badgeBg: "bg-purple-200 text-purple-700",
    targetPath: "/admin",
  },
];

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function setPersonaCookies(p: Persona) {
  document.cookie = `mock_persona=${p.id}; path=/; max-age=86400`;
  document.cookie = `mock_user_role=${p.role}; path=/; max-age=86400`;
  document.cookie = `mock_token=mock_jwt_${p.role.toLowerCase()}_${p.id}; path=/; max-age=86400`;
  localStorage.setItem("active_persona", JSON.stringify(p));
}

function handleSignOut() {
  // Expire all persona cookies immediately
  document.cookie = "mock_persona=; path=/; max-age=0";
  document.cookie = "mock_user_role=; path=/; max-age=0";
  document.cookie = "mock_token=; path=/; max-age=0";
  localStorage.removeItem("active_persona");
  window.location.href = "/login";
}

/** variant="light"  → used in the white storefront navbar
 *  variant="dark"   → used in the dark admin sidebar */
interface PersonaSwitcherProps {
  variant?: "light" | "dark";
  collapsed?: boolean; // sidebar collapsed → icon-only trigger
}

export function PersonaSwitcher({ variant = "light", collapsed = false }: PersonaSwitcherProps) {
  const [current, setCurrent] = useState<Persona>(PERSONAS[0]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Read cookie on mount
  useEffect(() => {
    const id = getCookie("mock_persona");
    const found = PERSONAS.find((p) => p.id === id);
    if (found) setCurrent(found);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSelect(p: Persona) {
    setPersonaCookies(p);
    setCurrent(p);
    setOpen(false);
    window.location.href = p.targetPath;
  }

  /* ── trigger styles per variant ── */
  const triggerBase =
    "flex items-center gap-1.5 rounded-lg text-xs font-medium transition cursor-pointer select-none";
  const triggerLight =
    "px-3 py-1.5 border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100";
  const triggerDark =
    "px-3 py-2 w-full border border-slate-600 bg-white/5 text-slate-200 hover:bg-white/10";

  /* ── dropdown styles per variant ── */
  const dropdownLight =
    "absolute right-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden";
  const dropdownDark =
    "absolute left-0 bottom-full mb-1.5 w-52 bg-slate-800 border border-slate-600 rounded-xl shadow-lg z-50 overflow-hidden";

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${triggerBase} ${variant === "dark" ? triggerDark : triggerLight}`}
        title="Switch User"
      >
        <Users className="w-3.5 h-3.5 shrink-0" />
        {!collapsed && (
          <>
            <span className="hidden sm:inline">{current.name}</span>
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${current.badgeBg}`}>
              {current.badge}
            </span>
            <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className={variant === "dark" ? dropdownDark : dropdownLight}>
          <p className={`px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider ${
            variant === "dark" ? "text-slate-500" : "text-slate-400"
          }`}>
            Switch User
          </p>
          {PERSONAS.map((p) => {
            const isActive = p.id === current.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition ${
                  isActive
                    ? variant === "dark"
                      ? "bg-white/10 text-white"
                      : "bg-slate-50 text-slate-900"
                    : variant === "dark"
                    ? "text-slate-300 hover:bg-white/5 hover:text-white"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${p.badgeBg}`}>
                  {p.badge}
                </span>
                <span className="text-xs font-medium flex-1">{p.name}</span>
                {isActive && <Check className="w-3.5 h-3.5 shrink-0 text-indigo-500" />}
              </button>
            );
          })}

          {/* Sign Out */}
          <div className={`border-t mt-1 pt-1 ${variant === "dark" ? "border-slate-600" : "border-slate-100"}`}>
            <button
              type="button"
              onClick={handleSignOut}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition text-xs font-medium ${
                variant === "dark"
                  ? "text-red-400 hover:bg-white/5 hover:text-red-300"
                  : "text-red-500 hover:bg-red-50"
              }`}
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
