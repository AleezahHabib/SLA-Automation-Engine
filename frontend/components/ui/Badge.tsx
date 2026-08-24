import React from "react";
import { cn } from "@/lib/utils";
import { Priority, SlaPresentationState, TicketStatus } from "@/types/enums";
import { AlertCircle, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "destructive"
    | "status"
    | "priority"
    | "sla";
  status?: TicketStatus | string;
  priority?: Priority | string;
  slaState?: SlaPresentationState | string;
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "default",
  status,
  priority,
  slaState,
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";

  // Status-specific badges
  if (status) {
    const s = status.toLowerCase();
    let statusClass = "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    let label = status;

    if (s === TicketStatus.OPEN) {
      statusClass = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";
      label = "Open";
    } else if (s === TicketStatus.IN_PROGRESS) {
      statusClass = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
      label = "In Progress";
    } else if (s === TicketStatus.RESOLVED) {
      statusClass = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
      label = "Resolved";
    } else if (s === TicketStatus.CLOSED) {
      statusClass = "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700";
      label = "Closed";
    }

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 font-medium rounded-md border",
          statusClass,
          sizeClasses,
          className
        )}
        {...props}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {children || label}
      </span>
    );
  }

  // Priority-specific badges
  if (priority) {
    const p = priority.toLowerCase();
    let prioClass = "bg-slate-100 text-slate-700 border-slate-200";
    let label = priority;

    if (p === Priority.CRITICAL) {
      prioClass = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 font-semibold";
      label = "Critical (2h)";
    } else if (p === Priority.HIGH) {
      prioClass = "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800 font-medium";
      label = "High (8h)";
    } else if (p === Priority.MEDIUM) {
      prioClass = "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800";
      label = "Medium (24h)";
    } else if (p === Priority.LOW) {
      prioClass = "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800";
      label = "Low (72h)";
    }

    return (
      <span
        className={cn(
          "inline-flex items-center font-medium rounded-md border uppercase tracking-wider",
          prioClass,
          sizeClasses,
          className
        )}
        {...props}
      >
        {children || label}
      </span>
    );
  }

  // SLA Presentation State badges
  if (slaState) {
    const st = slaState.toLowerCase();
    if (st === SlaPresentationState.BREACHED) {
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 font-semibold rounded-md border bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-700 animate-badge-pulse",
            sizeClasses,
            className
          )}
          {...props}
        >
          <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
          {children || "SLA Breached"}
        </span>
      );
    } else if (st === SlaPresentationState.AT_RISK) {
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 font-semibold rounded-md border bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700",
            sizeClasses,
            className
          )}
          {...props}
        >
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          {children || "At Risk (<25%)"}
        </span>
      );
    } else {
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 font-medium rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
            sizeClasses,
            className
          )}
          {...props}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          {children || "On Track"}
        </span>
      );
    }
  }

  // Generic badge
  const variantStyles = {
    default: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800",
    secondary: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
    outline: "border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300",
    destructive: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
    status: "",
    priority: "",
    sla: "",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-md border",
        variantStyles[variant],
        sizeClasses,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
