"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ChevronDown,
  LogOut,
  Shield,
  Store,
  User as UserIcon,
  LogIn,
  Sparkles,
} from "lucide-react";

interface PersonaSwitcherProps {
  variant?: "light" | "dark";
  collapsed?: boolean;
}

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "EMPLOYEE" | "MANAGER" | "ADMIN";
  departmentId: string;
  authProvider: "clerk" | "session" | "demo";
}

const DEMO_PERSONAS = [
  { id: "user-alice-emp", name: "Alice Vance", role: "EMPLOYEE", department: "Engineering", targetPath: "/" },
  { id: "user-bob-emp", name: "Bob Miller", role: "EMPLOYEE", department: "Marketing", targetPath: "/" },
  { id: "user-carol-mgr", name: "Carol Chen", role: "MANAGER", department: "Engineering", targetPath: "/admin" },
  { id: "user-dave-adm", name: "Dave Vance", role: "ADMIN", department: "Operations", targetPath: "/admin" },
];

export function PersonaSwitcher({ variant = "light", collapsed = false }: PersonaSwitcherProps) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setUser(data.authenticated ? data.user : null);
        setDemoModeEnabled(Boolean(data.demoModeEnabled));
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setIsLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleLogout = async () => {
    setIsBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  };

  const handleSwitchDemoPersona = async (persona: (typeof DEMO_PERSONAS)[number]) => {
    setIsBusy(true);
    try {
      const res = await fetch("/api/auth/demo-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId: persona.id }),
      });
      if (res.ok) {
        setIsOpen(false);
        window.location.assign(persona.targetPath);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const isDark = variant === "dark";

  if (!isLoaded) {
    return (
      <div
        className={`h-9 rounded-lg animate-pulse ${
          collapsed ? "w-9" : "w-36"
        } ${isDark ? "bg-slate-800" : "bg-slate-200 dark:bg-slate-800"}`}
      />
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
          isDark
            ? "bg-indigo-600 hover:bg-indigo-500 text-white"
            : "bg-slate-900 dark:bg-indigo-600 text-white hover:bg-slate-800 dark:hover:bg-indigo-500"
        }`}
      >
        <LogIn className="w-3.5 h-3.5" />
        {!collapsed && <span>Sign In</span>}
      </Link>
    );
  }

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={`flex items-center gap-2.5 rounded-xl border transition ${
          collapsed ? "p-1.5 justify-center w-full" : "px-3 py-1.5"
        } ${
          isDark
            ? "bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        }`}
        title={`${user.name} (${user.role})`}
      >
        <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
          {initials}
        </span>

        {!collapsed && (
          <>
            <div className="text-left min-w-0">
              <p className="text-xs font-semibold truncate max-w-[120px]">{user.name}</p>
              <p className="text-[10px] opacity-70 uppercase tracking-wider font-bold">
                {user.role}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
          </>
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 mt-2 w-64 rounded-xl border shadow-xl p-2 space-y-1.5 ${
            isDark
              ? "left-0 bottom-full mb-2 bg-slate-900 border-slate-700 text-slate-200"
              : "right-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
          }`}
        >
          <div className="px-2.5 py-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <UserIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <p className="text-xs font-bold truncate">{user.name}</p>
            </div>
            <p className="text-[11px] opacity-70 truncate mt-0.5">{user.email}</p>
          </div>

          {(user.role === "ADMIN" || user.role === "MANAGER") && (
            <Link
              href="/admin"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Shield className="w-3.5 h-3.5 text-indigo-500" />
              <span>Admin Portal</span>
            </Link>
          )}

          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <Store className="w-3.5 h-3.5 text-emerald-500" />
            <span>Storefront Catalog</span>
          </Link>

          {demoModeEnabled && (
            <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 space-y-1">
              <div className="px-2.5 py-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-500">
                <Sparkles className="w-3 h-3" />
                <span>Demo Personas</span>
              </div>
              {DEMO_PERSONAS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleSwitchDemoPersona(p)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition ${
                    user.id === p.id
                      ? "bg-indigo-600/20 text-indigo-500 dark:text-indigo-300 font-semibold"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  <span className="text-[10px] font-bold opacity-75">{p.role}</span>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={isBusy}
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition border-t border-slate-200 dark:border-slate-800"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
