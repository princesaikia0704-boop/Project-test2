"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ClipboardCheck,
  Settings,
  ScrollText,
  Briefcase,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PersonaSwitcher } from "@/components/shared/PersonaSwitcher";
import { useBranding } from "@/hooks/useBranding";
import { sanitizeSafeUrl } from "@/lib/security/url";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { companyName, logoUrl } = useBranding();
  const safeLogoUrl = sanitizeSafeUrl(logoUrl);
  const [logoError, setLogoError] = useState(false);
  const [authState, setAuthState] = useState<"checking" | "authorized" | "unauthorized">("checking");

  useEffect(() => {
    setLogoError(false);
  }, [safeLogoUrl]);

  // Verify admin/manager authorization before mounting privileged controls
  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        const role = data?.user?.role;
        if (data?.authenticated && (role === "ADMIN" || role === "MANAGER")) {
          setAuthState("authorized");
        } else {
          setAuthState("unauthorized");
          window.location.assign(`/login?redirect=${encodeURIComponent(pathname || "/admin")}`);
        }
      })
      .catch(() => {
        if (!active) return;
        setAuthState("unauthorized");
        window.location.assign("/login");
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  // Fetch pending approvals count for badge
  useEffect(() => {
    if (authState !== "authorized") return;

    const fetchApprovals = async () => {
      try {
        const apprRes = await fetch("/api/admin/approvals");
        if (apprRes.ok) {
          const data = await apprRes.json();
          setPendingCount(data.count || 0);
        }
      } catch {
        // Silently fail polling
      }
    };

    fetchApprovals();
    const interval = setInterval(fetchApprovals, 30_000);
    return () => clearInterval(interval);
  }, [authState]);

  const navItems: NavItem[] = [
    {
      href: "/admin",
      label: "Dashboard",
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      href: "/admin/catalog",
      label: "Catalog",
      icon: <Package className="w-5 h-5" />,
    },
    {
      href: "/admin/approvals",
      label: "Approvals",
      icon: <ClipboardCheck className="w-5 h-5" />,
      badge: pendingCount,
    },
    {
      href: "/admin/settings",
      label: "Settings",
      icon: <Settings className="w-5 h-5" />,
    },
    {
      href: "/admin/audit-logs",
      label: "Audit Logs",
      icon: <ScrollText className="w-5 h-5" />,
    },
  ];

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  if (authState !== "authorized") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center text-sm font-medium">
        {authState === "checking" ? "Verifying administrator session..." : "Redirecting to sign in..."}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex font-sans transition-colors duration-200">
      {/* Sidebar */}
      <aside
        data-testid="admin-sidebar"
        className={`sticky top-0 h-screen bg-slate-900 text-white flex flex-col transition-all duration-300 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-700 shrink-0">
          <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
            {safeLogoUrl && !logoError ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={safeLogoUrl}
                alt={companyName}
                className="w-full h-full object-contain p-1"
                onError={() => setLogoError(true)}
              />
            ) : (
              <Briefcase className="w-5 h-5 text-white" />
            )}
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-black text-sm leading-tight truncate">{companyName}</span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide">
                Admin Panel
              </span>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
                {item.badge && item.badge > 0 ? (
                  <span
                    data-testid="pending-approvals-badge"
                    className={`${
                      collapsed
                        ? "absolute -top-1 -right-1 w-5 h-5 text-[10px]"
                        : "ml-auto px-2 py-0.5 text-[11px]"
                    } bg-amber-500 text-white font-bold rounded-full flex items-center justify-center`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer — Persona Switcher + Collapse */}
        <div className="border-t border-slate-700 px-3 py-3 space-y-2 shrink-0">
          <PersonaSwitcher variant="dark" collapsed={collapsed} />
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            data-testid="sidebar-toggle"
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition text-xs"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
