"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Role, Priority, TicketStatus } from "@/types/enums";
import { LandingNav } from "@/components/landing/LandingNav";
import { InteractiveSlaSimulator } from "@/components/landing/InteractiveSlaSimulator";
import { StateMachineVisualizer } from "@/components/landing/StateMachineVisualizer";
import { DemoCredentialsSection } from "@/components/landing/DemoCredentialsSection";
import {
  Clock,
  Shield,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Database,
  Layers,
  Activity,
  ArrowRight,
  Sparkles,
  Terminal,
  Cpu,
  Building2,
  Users,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Server,
  FileCheck,
} from "lucide-react";

export default function LandingPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [heroSeconds, setHeroSeconds] = useState(4820); // ~1h 20m remaining

  // Live ticking countdown simulation in hero
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroSeconds((prev) => (prev > 0 ? prev - 1 : 7200));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatHeroCountdown = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/20 selection:text-indigo-300 font-sans">
      {/* Sticky Navigation */}
      <LandingNav />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
        {/* Background Gradients & Mesh Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] md:w-[900px] h-[400px] bg-gradient-to-tr from-indigo-600/20 via-violet-600/20 to-pink-600/10 blur-[130px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-10 left-10 w-72 h-72 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Hero Content */}
            <div className="lg:col-span-7 text-center lg:text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300 shadow-sm backdrop-blur-md">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Autonomous SLA Engine & Deterministic Triage
              </div>

              {/* Main Headline */}
              <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.12]">
                High-Integrity Support Desk with{" "}
                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
                  Zero-Breach Automation
                </span>
              </h1>

              {/* Subheading */}
              <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                Engineered for enterprise reliability. Built with FastAPI, Next.js 14, and an autonomous{" "}
                <code className="text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/60 font-mono text-xs">
                  asyncio
                </code>{" "}
                daemon that monitors SLA deadlines using non-blocking row-level database locks.
              </p>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <a
                  href="#demo-credentials"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-600/30 hover:from-indigo-500 hover:to-violet-500 transition-all hover:scale-[1.02] active:scale-95"
                >
                  <Sparkles className="h-4 w-4" />
                  Test Drive Seed Accounts
                </a>
                <a
                  href="#simulator"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 px-6 py-3.5 text-sm font-bold text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition-all active:scale-95"
                >
                  <Activity className="h-4 w-4 text-indigo-400" />
                  Interactive SLA Playground
                </a>
              </div>

              {/* Quick Tech Specs Ticker */}
              <div className="mt-10 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Strict Linear State Machine</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>SQL Multi-Tenant Isolation</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Sub-Second Worker Polling</span>
                </div>
              </div>
            </div>

            {/* Right Hero Live Interactive Card Preview */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/95 to-slate-950/95 p-6 shadow-2xl backdrop-blur-2xl">
                {/* Header of Preview */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                    <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 font-mono text-xs text-slate-400">Live Ticket Monitor</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    ASYNC WORKER ACTIVE
                  </span>
                </div>

                {/* Ticket Body Preview */}
                <div className="mt-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-400">#TK-4902</span>
                        <span className="rounded bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-400 uppercase">
                          Critical
                        </span>
                      </div>
                      <h4 className="mt-1.5 text-base font-bold text-white leading-snug">
                        Production API Gateway Latency Spike &gt; 500ms
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">Tenant: Acme Corp • Assigned: Agent Sarah</p>
                    </div>
                  </div>

                  {/* Live Hero Countdown Display */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-indigo-400" />
                        SLA Resolution Window (2h)
                      </span>
                      <span className="font-semibold text-emerald-400">ON TRACK</span>
                    </div>

                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="font-mono text-3xl font-black tracking-tight text-white">
                        {formatHeroCountdown(heroSeconds)}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">Deadline: 14:30:00 UTC</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 via-teal-400 to-emerald-400 transition-all duration-1000"
                        style={{ width: `${((7200 - heroSeconds) / 7200) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* State Machine Step Preview */}
                  <div className="flex items-center justify-between rounded-xl bg-slate-900/60 border border-slate-800/80 p-3 text-xs">
                    <span className="text-slate-400">Status Transition:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-indigo-400">In Progress</span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                      <span className="font-semibold text-slate-500">Resolved</span>
                    </div>
                  </div>

                  {/* Quick Action Button */}
                  <Link
                    href="/login"
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-500 transition-colors"
                  >
                    Open Live Triage Workspace
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Architectural Pillars / Features */}
      <section id="features" className="py-20 bg-slate-900/40 border-y border-slate-800/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400">
              <Shield className="h-3.5 w-3.5" />
              Engine Architectural Pillars
            </div>
            <h2 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              Built for Invariant Integrity & High Throughput
            </h2>
            <p className="mt-3 text-base text-slate-400">
              Every transition, priority score, and SLA countdown is strictly governed by
              database constraints and background worker daemons.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Pillar 1 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-7 hover:border-indigo-500/40 transition-all duration-300 group">
              <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-white">Deterministic Priority Scoring</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Rules-based automatic priority assignment upon ticket creation: Critical (2h),
                High (8h), Medium (24h), and Low (72h). Enforced without human bias.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-7 hover:border-violet-500/40 transition-all duration-300 group">
              <div className="h-12 w-12 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Cpu className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-white">Autonomous asyncio Worker</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Continuous background monitoring via <code className="text-violet-300 font-mono">FOR UPDATE SKIP LOCKED</code>.
                Detects breaches and near-breach states without stalling live API requests.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-7 hover:border-emerald-500/40 transition-all duration-300 group">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-white">Strict Linear State Machine</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Strict transitions: <code className="text-emerald-300 font-mono">open ➔ in_progress ➔ resolved ➔ closed</code>.
                Closed tickets are terminal and permanently locked against reopening.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-7 hover:border-pink-500/40 transition-all duration-300 group">
              <div className="h-12 w-12 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-white">SQL Multi-Tenant Isolation</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Customer portals enforce SQL-level filtering. External clients only see their own
                organization tickets, live countdown meters, and public comments.
              </p>
            </div>

            {/* Pillar 5 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-7 hover:border-amber-500/40 transition-all duration-300 group">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileCheck className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-white">Transactional Audit Trails</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Every priority override, state transition, and agent assignment writes an immutable
                audit log record in the same atomic database transaction.
              </p>
            </div>

            {/* Pillar 6 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-7 hover:border-teal-500/40 transition-all duration-300 group">
              <div className="h-12 w-12 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-white">Real-Time Operational Metrics</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Instant analytics for MTTR (Mean Time to Resolution), SLA compliance rates,
                queue backlogs, and per-agent workload distribution.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive SLA Engine Simulator */}
      <section id="simulator" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <InteractiveSlaSimulator />
      </section>

      {/* State Machine Lifecycle Visualizer */}
      <section id="state-machine" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <StateMachineVisualizer />
      </section>

      {/* Instant Demo Accounts Launchpad */}
      <DemoCredentialsSection />

      {/* Architecture Deep-Dive Section */}
      <section id="architecture" className="py-20 bg-slate-900/50 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400">
              <Server className="h-3.5 w-3.5" />
              Native Cloud Architecture
            </div>
            <h2 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              Zero-Docker Source Execution
            </h2>
            <p className="mt-3 text-base text-slate-400">
              Designed for direct native deployment on Railway (FastAPI async + PostgreSQL)
              and Vercel (Next.js 14 App Router).
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
              <div className="flex items-center gap-3 text-indigo-400 font-bold text-sm">
                <Activity className="h-5 w-5" />
                <span>Backend Services</span>
              </div>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                Python 3.11+ with FastAPI, SQLAlchemy 2.0 Async, Pydantic v2 schemas, and JWT authentication with role claims.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-indigo-400" />
                  <span>REST API at <code className="text-indigo-300 font-mono">/api/v1</code></span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Autonomous <code className="text-indigo-300 font-mono">asyncio</code> SLA Daemon</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Automated Database Migrations</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
              <div className="flex items-center gap-3 text-violet-400 font-bold text-sm">
                <Database className="h-5 w-5" />
                <span>Data &amp; Concurrency Layer</span>
              </div>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                PostgreSQL with asyncpg driver, row-level locks for concurrent worker evaluation, and transactional audit trails.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-violet-400" />
                  <span>ACID atomic state transitions</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-violet-400" />
                  <span>Zero-drift foreign key references</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-violet-400" />
                  <span>Tenant boundary constraints</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
              <div className="flex items-center gap-3 text-pink-400 font-bold text-sm">
                <Layers className="h-5 w-5" />
                <span>Frontend Application</span>
              </div>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                Next.js 14 App Router with TypeScript, TailwindCSS design system tokens, Recharts for KPIs, and live countdown badges.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-pink-400" />
                  <span>Staff Triage Desk &amp; Customer Portal</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-pink-400" />
                  <span>Session context with role guard</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-pink-400" />
                  <span>Optimized sub-second revalidation</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-20 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-indigo-500/40 bg-gradient-to-r from-indigo-950/80 via-slate-900 to-violet-950/80 p-8 sm:p-12 text-center shadow-2xl relative">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 mb-6">
              <Clock className="h-6 w-6" />
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Ready to Experience Zero-Breach SLA Automation?
            </h2>
            <p className="mt-4 text-slate-300 text-sm sm:text-base max-w-xl mx-auto">
              Launch into the support workspace or register a dedicated customer portal tenant in seconds.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-600/30 hover:bg-indigo-500 transition-all hover:scale-[1.02]"
              >
                Sign In to Workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/register/customer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-6 py-3.5 text-sm font-bold text-slate-200 hover:bg-slate-800 transition-all"
              >
                Register Customer Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Modern Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Clock className="h-4 w-4" />
            </div>
            <span className="font-bold text-slate-300 text-sm">SLA Automation Engine</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            <a href="#features" className="hover:text-slate-300 transition-colors">
              Features
            </a>
            <a href="#simulator" className="hover:text-slate-300 transition-colors">
              SLA Simulator
            </a>
            <a href="#state-machine" className="hover:text-slate-300 transition-colors">
              State Machine
            </a>
            <a href="#demo-credentials" className="hover:text-slate-300 transition-colors">
              Demo Accounts
            </a>
            <Link href="/login" className="hover:text-slate-300 transition-colors">
              Sign In
            </Link>
          </div>

          <p>© 2026 SLA Automation Engine. High-integrity customer support platform.</p>
        </div>
      </footer>
    </div>
  );
}

// Small check icon helper
function Check(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
