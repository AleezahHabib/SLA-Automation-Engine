"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Role } from "@/types/enums";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Clock,
  FolderOpen,
  Inbox,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  Shield,
  Ticket as TicketIcon,
  UserCheck,
  Users,
} from "lucide-react";

interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const isAdmin = user.role === Role.ADMIN;
  const isAgent = user.role === Role.AGENT;
  const isCustomer = user.role === Role.CUSTOMER;

  const navItems = isCustomer
    ? [
        {
          label: "My Support Tickets",
          href: "/portal",
          icon: TicketIcon,
        },
        {
          label: "Submit New Ticket",
          href: "/portal/new",
          icon: PlusCircle,
        },
      ]
    : [
        {
          label: "All Tickets",
          href: "/tickets",
          icon: TicketIcon,
        },
        {
          label: "Create Ticket",
          href: "/tickets/new",
          icon: PlusCircle,
        },
        ...(isAgent
          ? [
              {
                label: "My Queue",
                href: "/tickets?assigned_to_me=true",
                icon: Inbox,
              },
              {
                label: "Unassigned Pool",
                href: "/tickets?unassigned=true",
                icon: FolderOpen,
              },
            ]
          : []),
        ...(isAdmin
          ? [
              {
                label: "Customer Accounts",
                href: "/customers",
                icon: Users,
              },
              {
                label: "Agent Dispatch & Workload",
                href: "/agents",
                icon: UserCheck,
              },
              {
                label: "SLA Metrics & Analytics",
                href: "/metrics",
                icon: BarChart3,
              },
            ]
          : []),
      ];

  const getRoleBadge = () => {
    if (isAdmin) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-xs font-medium text-rose-300">
          <Shield className="h-3 w-3" /> Admin
        </span>
      );
    }
    if (isAgent) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-300">
          <UserCheck className="h-3 w-3" /> Agent
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
        Customer
      </span>
    );
  };

  const userInitials = user.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border transition-all",
          isCollapsed ? "justify-center px-2 relative" : "justify-between px-5"
        )}
      >
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 overflow-hidden group",
            isCollapsed && "justify-center"
          )}
          title="SLA Engine"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform">
            <Clock className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <div className="truncate">
              <h1 className="text-sm font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
                SLA Engine
              </h1>
              <p className="text-[11px] text-slate-400">Automation & Triage</p>
            </div>
          )}
        </Link>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              "rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors",
              isCollapsed &&
                "absolute -right-3 top-5 z-40 flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 shadow-md hover:bg-indigo-600 hover:text-white p-0"
            )}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-3.5 w-3.5" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* User Profile Summary */}
      <div className={cn("border-b border-sidebar-border transition-all", isCollapsed ? "p-3 flex flex-col items-center" : "p-4")}>
        {isCollapsed ? (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-indigo-400 border border-slate-700 shadow-inner"
            title={`${user.full_name} (${user.role})`}
          >
            {userInitials}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="truncate">
                <p className="truncate text-xs font-medium text-slate-200">
                  {user.full_name}
                </p>
                <p className="truncate text-[11px] text-slate-400">{user.email}</p>
              </div>
              <div>{getRoleBadge()}</div>
            </div>
            {user.customer_name && (
              <p className="mt-1 truncate text-[11px] text-indigo-300">
                {user.customer_name}
              </p>
            )}
          </>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/tickets" && item.href !== "/portal" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.label}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg text-xs font-medium transition-colors",
                isCollapsed
                  ? "justify-center p-3"
                  : "gap-3 px-3 py-2.5",
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={logout}
          title={isCollapsed ? "Sign Out" : undefined}
          className={cn(
            "flex w-full items-center rounded-lg text-xs font-medium text-slate-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors",
            isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
