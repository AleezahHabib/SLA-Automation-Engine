"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Priority, SlaPresentationState, TicketStatus } from "@/types/enums";
import { AlertCircle, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface SlaBadgeProps {
  createdAt: string;
  deadline: string;
  status: TicketStatus | string;
  priority: Priority | string;
  isBreached: boolean;
  className?: string;
}

const PRIORITY_TOTAL_SECONDS: Record<string, number> = {
  [Priority.CRITICAL]: 2 * 3600,
  [Priority.HIGH]: 8 * 3600,
  [Priority.MEDIUM]: 24 * 3600,
  [Priority.LOW]: 72 * 3600,
};

export function SlaBadge({
  createdAt,
  deadline,
  status,
  priority,
  isBreached,
  className,
}: SlaBadgeProps) {
  const [now, setNow] = useState<number>(() => Date.now());

  const isResolvedOrClosed =
    status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED;

  useEffect(() => {
    if (isResolvedOrClosed) return;
    const interval = setInterval(() => setNow(Date.now()), 10000); // 10s tick for list rows
    return () => clearInterval(interval);
  }, [isResolvedOrClosed]);

  const deadlineTime = new Date(deadline).getTime();
  const createdTime = new Date(createdAt).getTime();
  const remainingMs = deadlineTime - now;

  const totalWindowMs =
    PRIORITY_TOTAL_SECONDS[priority.toLowerCase()] * 1000 ||
    Math.max(deadlineTime - createdTime, 3600000);

  if (isResolvedOrClosed) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border",
          isBreached
            ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
            : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
          className
        )}
      >
        {isBreached ? "SLA Missed" : "SLA Met"}
      </span>
    );
  }

  let state = SlaPresentationState.ON_TRACK;
  if (isBreached || remainingMs <= 0) {
    state = SlaPresentationState.BREACHED;
  } else if (remainingMs <= totalWindowMs * 0.25) {
    state = SlaPresentationState.AT_RISK;
  }

  const formatShortDuration = (ms: number): string => {
    const absMins = Math.floor(Math.abs(ms) / 60000);
    const hours = Math.floor(absMins / 60);
    const mins = absMins % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const timeStr = formatShortDuration(remainingMs);

  if (state === SlaPresentationState.BREACHED) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800 animate-badge-pulse",
          className
        )}
      >
        <AlertCircle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
        Breached (+{timeStr})
      </span>
    );
  }

  if (state === SlaPresentationState.AT_RISK) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
          className
        )}
      >
        <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
        {timeStr} left
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
        className
      )}
    >
      <Clock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
      {timeStr} left
    </span>
  );
}
