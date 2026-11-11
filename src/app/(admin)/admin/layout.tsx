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
  Shield,
} from "lucide-react";

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
  const [userRole, setUserRole] = useState<string>("ADMIN");

  // Fetch pending approvals count for badge
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await fetch("/api/admin/approvals");
        if (res.ok) {
          const data = await res.json();
          setPendingCount(data.count || 0);
        }
      } catch {
        // Silently fail badge count
      }
    };

    fetchPending();
    const interval = setInterval(fetchPending, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Detect user role from a lightweight cookie/header-based approach
  // In practice, the middleware sets headers. For client-side display we fetch from an endpoint or use a cookie.
  useEffect(() => {
    // Read role from cookie set by middleware, or default to ADMIN
    const getCookieValue = (name: string) => {
      const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
      return match ? match[2] : null;
    };
    const cookieRole = getCookieValue("x-user-role");
    if (cookieRole) {
      setUserRole(cookieRole);
    }
  }, []);

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

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Sidebar */}
      <aside
        data-testid="admin-sidebar"
        className={`sticky top-0 h-screen bg-slate-900 text-white flex flex-col transition-all duration-300 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-700 shrink-0">
          <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-black text-sm leading-tight truncate">Office Store</span>
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

        {/* User Role Badge & Collapse Toggle */}
        <div className="border-t border-slate-700 px-3 py-3 space-y-2 shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5">
              <Shield className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 block">Role</span>
                <span className="text-xs font-bold text-white">{userRole}</span>
              </div>
            </div>
          )}
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
