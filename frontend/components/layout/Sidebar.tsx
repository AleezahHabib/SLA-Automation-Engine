"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Role } from "@/types/enums";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  CheckSquare,
  Clock,
  FolderOpen,
  Inbox,
  LogOut,
  PlusCircle,
  Shield,
  Ticket as TicketIcon,
  UserCheck,
  Users,
} from "lucide-react";

export function Sidebar() {
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
        Customer Portal
      </span>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-white">
            SLA Engine
          </h1>
          <p className="text-[11px] text-slate-400">Automation & Triage</p>
        </div>
      </div>

      {/* User Profile Summary */}
      <div className="border-b border-sidebar-border p-4">
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
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/tickets" && item.href !== "/portal" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
