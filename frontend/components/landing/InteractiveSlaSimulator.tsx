"use client";

import React, { useState } from "react";
import { Priority, SlaPresentationState } from "@/types/enums";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Activity,
  RefreshCw,
  Cpu,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

interface PriorityConfig {
  label: string;
  totalMinutes: number;
  atRiskMinutes: number; // remaining minutes below which it becomes at_risk
  description: string;
  colorClass: string;
  badgeBg: string;
}

const PRIORITY_RULES: Record<Priority, PriorityConfig> = {
  [Priority.CRITICAL]: {
    label: "Critical",
    totalMinutes: 120, // 2h
    atRiskMinutes: 30, // 30m remaining
    description: "Production down, severe security vulnerability, global outage",
    colorClass: "text-rose-400 border-rose-500/30 bg-rose-500/10",
    badgeBg: "bg-rose-500",
  },
  [Priority.HIGH]: {
    label: "High",
    totalMinutes: 480, // 8h
    atRiskMinutes: 120, // 2h remaining
    description: "Major feature impairment, payment failures, customer blocked",
    colorClass: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    badgeBg: "bg-orange-500",
  },
  [Priority.MEDIUM]: {
    label: "Medium",
    totalMinutes: 1440, // 24h
    atRiskMinutes: 360, // 6h remaining
    description: "Non-critical workflow issue, reporting discrepancy, standard inquiry",
    colorClass: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    badgeBg: "bg-amber-500",
  },
  [Priority.LOW]: {
    label: "Low",
    totalMinutes: 4320, // 72h
    atRiskMinutes: 720, // 12h remaining
    description: "General questions, cosmetic improvements, feature requests",
    colorClass: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    badgeBg: "bg-emerald-500",
  },
};

export function InteractiveSlaSimulator() {
  const [selectedPriority, setSelectedPriority] = useState<Priority>(Priority.CRITICAL);
  const [elapsedPercentage, setElapsedPercentage] = useState<number>(35);
  const [workerScanning, setWorkerScanning] = useState(false);
  const [workerLogs, setWorkerLogs] = useState<string[]>([
    "worker.service: SLA monitor daemon active (interval=10s)",
    "worker.service: Acquired lock 'pg_try_advisory_xact_lock(sla_worker)'",
  ]);

  const config = PRIORITY_RULES[selectedPriority];
  const elapsedMinutes = Math.round((elapsedPercentage / 100) * config.totalMinutes);
  const remainingMinutes = config.totalMinutes - elapsedMinutes;

  let slaState: "on_track" | "at_risk" | "breached" = "on_track";
  if (remainingMinutes <= 0) {
    slaState = "breached";
  } else if (remainingMinutes <= config.atRiskMinutes) {
    slaState = "at_risk";
  }

  // Format time helper
  const formatTimeRemaining = (mins: number) => {
    if (mins <= 0) {
      const overMins = Math.abs(mins);
      const h = Math.floor(overMins / 60);
      const m = overMins % 60;
      return `Breached by ${h > 0 ? `${h}h ` : ""}${m}m`;
    }
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h ${m}m remaining`;
    return `${m}m remaining`;
  };

  const triggerWorkerScan = () => {
    setWorkerScanning(true);
    const timestamp = new Date().toLocaleTimeString();
    const newLogs = [
      `[${timestamp}] SCAN: SELECT id FROM tickets WHERE status != 'resolved' AND status != 'closed' FOR UPDATE SKIP LOCKED`,
      `[${timestamp}] EVAL: Ticket #TK-8021 priority=${selectedPriority.toUpperCase()} elapsed=${elapsedPercentage}% -> State=${slaState.toUpperCase()}`,
    ];

    if (slaState === "breached") {
      newLogs.push(
        `[${timestamp}] ALERT: Breach detected! Writing SLA_BREACH audit record & sending dispatcher alert.`
      );
    } else if (slaState === "at_risk") {
      newLogs.push(
        `[${timestamp}] WARN: SLA nearing threshold (<${config.atRiskMinutes / 60}h remaining). Escalation beacon queued.`
      );
    } else {
      newLogs.push(`[${timestamp}] OK: Ticket within healthy operational SLA target.`);
    }

    setTimeout(() => {
      setWorkerLogs((prev) => [...newLogs, ...prev.slice(0, 4)]);
      setWorkerScanning(false);
    }, 600);
  };

  return (
    <div className="relative rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-6 md:p-10 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-b border-slate-800/80 pb-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400">
            <Zap className="h-3.5 w-3.5" />
            Interactive Engine Simulator
          </div>
          <h3 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight text-white">
            Deterministic SLA & Worker Invariants
          </h3>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl">
            Test the deterministic priority rules and sub-second background worker evaluation.
            Adjust priority tiers and time elapsed to watch the state machine and SLA transitions live.
          </p>
        </div>

        <button
          onClick={triggerWorkerScan}
          disabled={workerScanning}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${workerScanning ? "animate-spin" : ""}`} />
          Run Worker Scan
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Priority & Sliders */}
        <div className="lg:col-span-7 space-y-6">
          {/* Priority selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              1. Select Priority Level
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(Object.keys(PRIORITY_RULES) as Priority[]).map((p) => {
                const isSelected = selectedPriority === p;
                const pConf = PRIORITY_RULES[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPriority(p)}
                    className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-600/15 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500"
                        : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-slate-200 capitalize">{p}</span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${pConf.colorClass}`}
                      >
                        {pConf.totalMinutes / 60}h SLA
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1">
                      Risk &lt; {pConf.atRiskMinutes >= 60 ? `${pConf.atRiskMinutes / 60}h` : `${pConf.atRiskMinutes}m`}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500 italic">{config.description}</p>
          </div>

          {/* Time Elapsed Slider */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-indigo-400" />
                2. Simulate Time Elapsed ({elapsedPercentage}%)
              </label>
              <span className="font-mono text-xs font-bold text-slate-300">
                {Math.floor(elapsedMinutes / 60)}h {elapsedMinutes % 60}m of {config.totalMinutes / 60}h
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="125"
              value={elapsedPercentage}
              onChange={(e) => setElapsedPercentage(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />

            {/* Presets */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setElapsedPercentage(15)}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                15% (Fresh)
              </button>
              <button
                type="button"
                onClick={() => setElapsedPercentage(50)}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                50% (Active)
              </button>
              <button
                type="button"
                onClick={() => setElapsedPercentage(82)}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                82% (At-Risk Threshold)
              </button>
              <button
                type="button"
                onClick={() => setElapsedPercentage(110)}
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[11px] font-medium text-rose-400 hover:bg-rose-500/20 transition-colors"
              >
                110% (Breached)
              </button>
            </div>
          </div>

          {/* Engine Invariants Box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="flex items-start gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
              <ShieldCheck className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-200">Terminal Resolution Rule</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Reaching <code className="text-indigo-300 font-mono">resolved</code> stops the SLA clock immediately.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
              <Activity className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-200">Non-Blocking Concurrency</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Async worker scans via <code className="text-emerald-300 font-mono">SKIP LOCKED</code> without DB locks.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Output & State Card */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
          {/* Real-time Ticket Status Card */}
          <div
            className={`rounded-2xl border p-6 transition-all duration-300 relative overflow-hidden ${
              slaState === "breached"
                ? "border-rose-500/50 bg-gradient-to-b from-rose-950/40 to-slate-900/90 shadow-2xl shadow-rose-950/30"
                : slaState === "at_risk"
                ? "border-amber-500/50 bg-gradient-to-b from-amber-950/30 to-slate-900/90 shadow-2xl shadow-amber-950/30"
                : "border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 to-slate-900/90 shadow-2xl shadow-emerald-950/20"
            }`}
          >
            {/* Ambient Glow */}
            <div
              className={`absolute top-0 right-0 h-32 w-32 rounded-full blur-3xl opacity-20 pointer-events-none ${
                slaState === "breached"
                  ? "bg-rose-500"
                  : slaState === "at_risk"
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
            />

            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-400">TICKET #TK-8021</span>
              {/* Dynamic State Badge */}
              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                  slaState === "breached"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse"
                    : slaState === "at_risk"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-badge-pulse"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                }`}
              >
                {slaState === "breached" ? (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-rose-400" />
                    SLA Breached
                  </>
                ) : slaState === "at_risk" ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    At Risk
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    On Track
                  </>
                )}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium text-slate-400">Database SLA Countdown</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
                  {formatTimeRemaining(remainingMinutes)}
                </span>
              </div>
            </div>

            {/* Visual Progress Meter */}
            <div className="mt-5 space-y-1.5">
              <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                <span>Progress: {Math.min(elapsedPercentage, 100)}%</span>
                <span>Deadline: {config.totalMinutes / 60} Hours</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden p-0.5 border border-slate-700">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    slaState === "breached"
                      ? "bg-gradient-to-r from-rose-600 to-rose-400"
                      : slaState === "at_risk"
                      ? "bg-gradient-to-r from-amber-500 to-amber-300"
                      : "bg-gradient-to-r from-emerald-500 to-teal-400"
                  }`}
                  style={{ width: `${Math.min(elapsedPercentage, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Autonomous Worker Live Stream */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] text-slate-400 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2 text-slate-300">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                <Cpu className="h-3.5 w-3.5" />
                Autonomous asyncio Worker Stream
              </span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                ACTIVE
              </span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {workerLogs.map((log, idx) => (
                <p
                  key={idx}
                  className={`leading-relaxed break-all ${
                    log.includes("BREACH")
                      ? "text-rose-400 font-semibold"
                      : log.includes("WARN")
                      ? "text-amber-400 font-semibold"
                      : log.includes("SCAN")
                      ? "text-indigo-300"
                      : "text-slate-400"
                  }`}
                >
                  {log}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
