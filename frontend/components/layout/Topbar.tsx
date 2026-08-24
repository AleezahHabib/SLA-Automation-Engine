"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { healthApi } from "@/lib/api";
import { Activity, Bell, User as UserIcon } from "lucide-react";

interface TopbarProps {
  title?: string;
  subtitle?: string;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  const { user } = useAuth();
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const res = await healthApi.check();
        if (isMounted) setIsHealthy(res.status === "healthy");
      } catch {
        if (isMounted) setIsHealthy(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
      <div>
        {title && (
          <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h2>
        )}
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* System Health Pulse */}
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
          <span
            className={`h-2 w-2 rounded-full ${
              isHealthy === true
                ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                : isHealthy === false
                ? "bg-rose-500 shadow-sm shadow-rose-500/50"
                : "bg-amber-400 animate-pulse"
            }`}
          />
          <span className="text-[11px]">
            {isHealthy === true
              ? "SLA Engine Online"
              : isHealthy === false
              ? "API Disconnected"
              : "Checking Engine..."}
          </span>
        </div>

        {/* User Identity Chip */}
        {user && (
          <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-800/80">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold leading-tight text-slate-900 dark:text-slate-100">
                {user.full_name}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                {user.role}
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
