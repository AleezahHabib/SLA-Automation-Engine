"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Priority, SlaPresentationState, TicketStatus } from "@/types/enums";
import { AlertCircle, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface SlaCountdownProps {
  createdAt: string;
  deadline: string;
  status: TicketStatus | string;
  priority: Priority | string;
  isBreached: boolean;
  resolvedAt?: string | null;
  className?: string;
  showProgress?: boolean;
}

const PRIORITY_TOTAL_SECONDS: Record<string, number> = {
  [Priority.CRITICAL]: 2 * 3600,
  [Priority.HIGH]: 8 * 3600,
  [Priority.MEDIUM]: 24 * 3600,
  [Priority.LOW]: 72 * 3600,
};

export function SlaCountdown({
  createdAt,
  deadline,
  status,
  priority,
  isBreached,
  resolvedAt,
  className,
  showProgress = true,
}: SlaCountdownProps) {
  const [now, setNow] = useState<number>(() => Date.now());

  const isResolvedOrClosed =
    status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED;

  // Live tick only if ticket is still open/in-progress
  useEffect(() => {
    if (isResolvedOrClosed) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [isResolvedOrClosed]);

  const createdTime = new Date(createdAt).getTime();
  const deadlineTime = new Date(deadline).getTime();
  const resolvedTime = resolvedAt ? new Date(resolvedAt).getTime() : null;

  // Total window duration in ms
  const totalWindowMs =
    PRIORITY_TOTAL_SECONDS[priority.toLowerCase()] * 1000 ||
    Math.max(deadlineTime - createdTime, 3600000);

  // If resolved/closed, freeze outcome
  if (isResolvedOrClosed) {
    const met =
      resolvedTime !== null
        ? resolvedTime <= deadlineTime
        : !isBreached;

    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium border",
          met
            ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
            : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
          className
        )}
      >
        {met ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>SLA Met on Resolution</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            <span>SLA Missed on Resolution</span>
          </>
        )}
      </div>
    );
  }

  // Active Countdown Calculation
  const remainingMs = deadlineTime - now;
  const elapsedMs = Math.max(now - createdTime, 0);
  const progressRatio = Math.min(Math.max(elapsedMs / totalWindowMs, 0), 1);
  const percentRemaining = Math.max(Math.round((1 - progressRatio) * 100), 0);

  let state: SlaPresentationState = SlaPresentationState.ON_TRACK;
  if (isBreached || remainingMs <= 0) {
    state = SlaPresentationState.BREACHED;
  } else if (remainingMs <= totalWindowMs * 0.25) {
    state = SlaPresentationState.AT_RISK;
  }

  // Format remaining or breached time
  const formatDuration = (ms: number): string => {
    const absSeconds = Math.floor(Math.abs(ms) / 1000);
    const hours = Math.floor(absSeconds / 3600);
    const minutes = Math.floor((absSeconds % 3600) / 60);
    const seconds = absSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const formattedTime = formatDuration(remainingMs);

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg p-2.5 border text-xs font-medium transition-colors",
        state === SlaPresentationState.BREACHED &&
          "bg-rose-50/80 border-rose-300 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200 animate-badge-pulse",
        state === SlaPresentationState.AT_RISK &&
          "bg-amber-50/80 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200",
        state === SlaPresentationState.ON_TRACK &&
          "bg-emerald-50/80 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {state === SlaPresentationState.BREACHED && (
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          )}
          {state === SlaPresentationState.AT_RISK && (
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          )}
          {state === SlaPresentationState.ON_TRACK && (
            <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          )}
          <span className="font-semibold">
            {state === SlaPresentationState.BREACHED
              ? `Breached by ${formattedTime}`
              : `${formattedTime} remaining`}
          </span>
        </div>
        <span className="text-[11px] opacity-80">
          {state === SlaPresentationState.BREACHED
            ? "Deadline Expired"
            : `${percentRemaining}% SLA left`}
        </span>
      </div>

      {showProgress && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
          <div
            className={cn(
              "h-full transition-all duration-500",
              state === SlaPresentationState.BREACHED && "bg-rose-600 dark:bg-rose-500 w-full",
              state === SlaPresentationState.AT_RISK && "bg-amber-500 dark:bg-amber-400",
              state === SlaPresentationState.ON_TRACK && "bg-emerald-500 dark:bg-emerald-400"
            )}
            style={{
              width: state === SlaPresentationState.BREACHED ? "100%" : `${100 - percentRemaining}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}
