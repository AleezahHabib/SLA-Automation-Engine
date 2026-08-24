"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Role } from "@/types/enums";
import { Loader2 } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  allowedRoles?: Role[];
}

export function AppShell({
  children,
  title,
  subtitle,
  allowedRoles,
}: AppShellProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/register/customer";

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated && !isPublicRoute) {
        router.replace("/login");
      } else if (isAuthenticated && isPublicRoute) {
        // Redirect to role default dashboard per spec 01
        if (user?.role === Role.CUSTOMER) {
          router.replace("/portal");
        } else {
          router.replace("/tickets");
        }
      } else if (
        isAuthenticated &&
        allowedRoles &&
        user &&
        !allowedRoles.includes(user.role as Role)
      ) {
        // Enforce role routing: customer trying to view staff routes or vice-versa
        if (user.role === Role.CUSTOMER) {
          router.replace("/portal");
        } else {
          router.replace("/tickets");
        }
      }
    }
  }, [isLoading, isAuthenticated, isPublicRoute, user, allowedRoles, router]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Rehydrating session...
          </p>
        </div>
      </div>
    );
  }

  // If public route, render naked children (like login/register screens)
  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <div className="pl-64">
        <Topbar title={title} subtitle={subtitle} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
