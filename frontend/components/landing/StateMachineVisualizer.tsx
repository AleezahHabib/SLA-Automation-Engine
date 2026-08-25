"use client";

import React, { useState } from "react";
import { TicketStatus, Role } from "@/types/enums";
import {
  Layers,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Lock,
  History,
  RotateCcw,
  Sparkles,
  AlertOctagon,
  UserCheck,
} from "lucide-react";

interface StateNode {
  status: TicketStatus;
  label: string;
  allowedRoles: string[];
  description: string;
  color: string;
  badgeBg: string;
  isTerminal?: boolean;
}

const STATES: StateNode[] = [
  {
    status: TicketStatus.OPEN,
    label: "Open",
    allowedRoles: ["Customer", "Admin", "Agent"],
    description: "Initial state. Priority scored, SLA countdown initiated in database.",
    color: "border-blue-500/40 text-blue-400 bg-blue-500/10",
    badgeBg: "bg-blue-500",
  },
  {
    status: TicketStatus.IN_PROGRESS,
    label: "In Progress",
    allowedRoles: ["Agent", "Admin"],
    description: "Assigned staff actively investigating. SLA countdown continuing.",
    color: "border-indigo-500/40 text-indigo-400 bg-indigo-500/10",
    badgeBg: "bg-indigo-500",
  },
  {
    status: TicketStatus.RESOLVED,
    label: "Resolved",
    allowedRoles: ["Agent", "Admin"],
    description: "Solution delivered. SLA timer halts immediately; MTTR recorded.",
    color: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
    badgeBg: "bg-emerald-500",
  },
  {
    status: TicketStatus.CLOSED,
    label: "Closed",
    allowedRoles: ["Admin"],
    description: "Terminal state. Complete audit locked; immutable historical record.",
    color: "border-slate-500/40 text-slate-300 bg-slate-500/10",
    badgeBg: "bg-slate-500",
    isTerminal: true,
  },
];

export function StateMachineVisualizer() {
  const [currentStatusIndex, setCurrentStatusIndex] = useState<number>(0);
  const [illegalAttempt, setIllegalAttempt] = useState<string | null>(null);
  const [transitionLogs, setTransitionLogs] = useState<string[]>([
    "INITIAL: Ticket created with status='open', SLA window assigned",
  ]);

  const currentStatus = STATES[currentStatusIndex];

  const advanceState = () => {
    setIllegalAttempt(null);
    if (currentStatusIndex < STATES.length - 1) {
      const nextIndex = currentStatusIndex + 1;
      const nextState = STATES[nextIndex];
      const prevState = STATES[currentStatusIndex];
      setCurrentStatusIndex(nextIndex);

      const timestamp = new Date().toLocaleTimeString();
      const log = `[${timestamp}] TRANSACTION SUCCESS: '${prevState.status}' -> '${nextState.status}' (Role=${nextState.allowedRoles.join("/")}, AuditRecord written)`;
      setTransitionLogs((prev) => [log, ...prev]);
    }
  };

  const tryIllegalReopen = () => {
    setIllegalAttempt(
      "HTTP 422 Unprocessable Entity: Illegal transition 'closed' -> 'open'. Invariant violation: closed tickets are terminal and cannot be reopened."
    );
  };

  const tryIllegalJump = () => {
    setIllegalAttempt(
      "HTTP 422 Unprocessable Entity: Illegal transition 'open' -> 'resolved'. Invariant violation: tickets must transition through 'in_progress' first."
    );
  };

  const resetState = () => {
    setCurrentStatusIndex(0);
    setIllegalAttempt(null);
    setTransitionLogs(["RESET: Ticket returned to 'open' state"]);
  };

  return (
    <div className="relative rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-6 md:p-10 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-b border-slate-800/80 pb-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-400">
            <Layers className="h-3.5 w-3.5" />
            Strict Linear State Machine
          </div>
          <h3 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight text-white">
            Deterministic Ticket Lifecycle Guarantees
          </h3>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl">
            State transitions are strictly linear and guarded at the database transaction layer.
            Terminal closure guarantees prevent stale loops or unauthorized reopening.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={resetState}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Flow
          </button>
          {currentStatusIndex < STATES.length - 1 ? (
            <button
              onClick={advanceState}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:from-indigo-500 hover:to-violet-500 transition-all active:scale-95"
            >
              Advance: {STATES[currentStatusIndex + 1].label}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={tryIllegalReopen}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-5 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-all active:scale-95"
            >
              <AlertOctagon className="h-4 w-4" />
              Test Illegal Reopen
            </button>
          )}
        </div>
      </div>

      {/* Illegal Attempt Notice Banner */}
      {illegalAttempt && (
        <div className="mt-6 rounded-2xl border border-rose-500/40 bg-rose-950/40 p-4 text-xs font-mono text-rose-300 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-rose-200">INVARIANT ENFORCEMENT CAUGHT AT ENGINE LEVEL:</span>
            <p className="mt-1 text-rose-300/90">{illegalAttempt}</p>
          </div>
        </div>
      )}

      {/* Visual State Nodes Pipeline */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {STATES.map((node, index) => {
          const isActive = index === currentStatusIndex;
          const isPassed = index < currentStatusIndex;

          return (
            <div
              key={node.status}
              className={`relative rounded-2xl border p-5 transition-all duration-300 flex flex-col justify-between ${
                isActive
                  ? "border-indigo-500 bg-slate-900 shadow-xl shadow-indigo-500/10 ring-2 ring-indigo-500/40"
                  : isPassed
                  ? "border-emerald-500/30 bg-slate-950/80 opacity-90"
                  : "border-slate-800 bg-slate-950/40 opacity-50"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-slate-300 font-mono">
                      0{index + 1}
                    </span>
                    <span className="text-sm font-bold text-white capitalize">{node.label}</span>
                  </div>
                  {isPassed && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                  {isActive && (
                    <span className="inline-flex h-2 w-2 rounded-full bg-indigo-400 animate-ping"></span>
                  )}
                  {node.isTerminal && (
                    <span className="text-[10px] uppercase font-bold text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded">
                      Terminal
                    </span>
                  )}
                </div>

                <p className="mt-3 text-xs text-slate-400 leading-relaxed">{node.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Allowed Roles:</span>
                  <span className="font-semibold text-slate-300">{node.allowedRoles.join(", ")}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active State Inspector & Audit Stream */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <UserCheck className="h-3.5 w-3.5 text-indigo-400" />
            Current State Context: {currentStatus.label.toUpperCase()}
          </h4>
          <div className="mt-4 space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400">SLA Timer Status:</span>
              <span className="font-mono font-bold text-slate-200">
                {currentStatusIndex >= 2 ? (
                  <span className="text-emerald-400">HALTED (Resolution Time Locked)</span>
                ) : (
                  <span className="text-amber-400">RUNNING (Autonomous Worker Scans Active)</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Permitted Transitions:</span>
              <span className="font-mono font-bold text-indigo-400">
                {currentStatusIndex === 0
                  ? "['in_progress']"
                  : currentStatusIndex === 1
                  ? "['resolved']"
                  : currentStatusIndex === 2
                  ? "['closed']"
                  : "None (Terminal State)"}
              </span>
            </div>
            {currentStatusIndex === 0 && (
              <button
                onClick={tryIllegalJump}
                className="w-full text-center py-2 text-[11px] font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-dashed border-slate-800"
              >
                Test Illegal Transition: Jump Open ➔ Resolved Directly
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <History className="h-3.5 w-3.5 text-violet-400" />
            Atomic PostgreSQL Audit Stream
          </h4>
          <div className="mt-4 space-y-2 max-h-36 overflow-y-auto font-mono text-[11px]">
            {transitionLogs.map((log, idx) => (
              <div
                key={idx}
                className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 leading-relaxed"
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
