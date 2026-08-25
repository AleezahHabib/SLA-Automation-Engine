"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Role } from "@/types/enums";
import { LandingNav } from "@/components/landing/LandingNav";
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
  Building2,
  Users,
  ChevronRight,
  UserCheck,
  Check,
  TrendingUp,
  BarChart3,
  Loader2,
} from "lucide-react";

export default function LandingPage() {
  const { user, isAuthenticated, login } = useAuth();
  const router = useRouter();

  const [heroSeconds, setHeroSeconds] = useState(6480); // 1h 48m
  const [loggingInRole, setLoggingInRole] = useState<string | null>(null);

  // Live ticking countdown simulation in hero preview
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroSeconds((prev) => (prev > 0 ? prev - 1 : 7200));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleQuickLogin = async (email: string, role: string) => {
    setLoggingInRole(role);
    try {
      const loggedUser = await login(email, "Password123!");
      if (loggedUser.role === Role.CUSTOMER) {
        router.push("/portal");
      } else {
        router.push("/tickets");
      }
    } catch {
      router.push("/login");
    } finally {
      setLoggingInRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/20 selection:text-indigo-300 font-sans">
      {/* Navbar */}
      <LandingNav />

      {/* Hero Section */}
      <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 overflow-hidden">
        {/* Soft Ambient Light Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Category Tag */}
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-semibold text-indigo-300">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Autonomous SLA Monitoring &amp; Triage Engine
          </div>

          {/* Main Headline */}
          <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-tight">
            Customer Support with{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
              Guaranteed SLAs
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Eliminate missed deadlines with real-time countdown meters, automated priority
            triage, and strict state machine lifecycle governance.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all hover:scale-[1.02]"
            >
              Sign In to Workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/register/customer"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-6 py-3.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Customer Sign Up
            </Link>
            <a
              href="#demo-accounts"
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <Sparkles className="h-4 w-4 text-indigo-400" />
              Try Demo Accounts
            </a>
          </div>

          {/* Live Product Preview Mockup Card */}
          <div className="mt-14 max-w-4xl mx-auto">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-6 shadow-2xl backdrop-blur-xl text-left relative overflow-hidden">
              {/* Window Bar */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                  <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 font-mono text-xs text-slate-400">Support Operations Desk</span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  SLA ENGINE ACTIVE
                </span>
              </div>

              {/* Sample Ticket Row */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-400">#TKT-000007</span>
                    <span className="rounded bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-400 uppercase">
                      Critical (2h SLA)
                    </span>
                    <span className="rounded bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                      In Progress
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    Tenant: <strong className="text-slate-200">Acme Corp</strong> • Assignee: <strong className="text-slate-200">Sarah Connor</strong>
                  </span>
                </div>

                <p className="text-sm font-semibold text-white">
                  Security inquiry regarding SSO SAML integration &amp; SCIM provisioning
                </p>

                {/* Countdown Progress Bar */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="h-3.5 w-3.5 text-indigo-400" />
                      Time Remaining:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-emerald-400">
                        {formatCountdown(heroSeconds)}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                        ON TRACK
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-1000"
                      style={{ width: `${((7200 - heroSeconds) / 7200) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Metric Ribbon */}
      <section className="border-y border-slate-800/80 bg-slate-900/40 py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-3xl font-black text-white">99.9%</p>
              <p className="text-xs text-slate-400 mt-1">SLA Target Compliance</p>
            </div>
            <div>
              <p className="text-3xl font-black text-indigo-400">&lt; 2 Hours</p>
              <p className="text-xs text-slate-400 mt-1">Critical Tier Resolution</p>
            </div>
            <div>
              <p className="text-3xl font-black text-emerald-400">100%</p>
              <p className="text-xs text-slate-400 mt-1">Audit Traceability</p>
            </div>
            <div>
              <p className="text-3xl font-black text-violet-400">Zero Lag</p>
              <p className="text-xs text-slate-400 mt-1">Autonomous asyncio Polling</p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section id="features" className="py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
            <Zap className="h-3.5 w-3.5" />
            Core Capabilities
          </div>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">
            Engineered for Flawless Ticket Governance
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            A support system built around deterministic business rules and autonomous monitoring.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 hover:border-slate-700 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Autonomous SLA Daemon</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Background Python <code className="text-indigo-300 font-mono">asyncio</code> service
              scans tickets via <code className="text-indigo-300 font-mono">FOR UPDATE SKIP LOCKED</code>,
              triggering at-risk alerts and breach flags without stalling database queries.
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 hover:border-slate-700 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mb-4">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Deterministic Priority Scoring</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Automatic rules calculate resolution windows upon intake: Critical (2h), High (8h),
              Medium (24h), and Low (72h). Enforces objective operational response.
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 hover:border-slate-700 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Strict Linear Lifecycle</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Enforces legal transitions: <code className="text-emerald-300 font-mono">open ➔ in_progress ➔ resolved ➔ closed</code>.
              Closed tickets are strictly terminal, ensuring immutable historic compliance records.
            </p>
          </div>

          {/* Card 4 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 hover:border-slate-700 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-pink-600/10 border border-pink-500/20 text-pink-400 flex items-center justify-center mb-4">
              <Building2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Multi-Tenant Customer Portal</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              SQL-level customer data isolation ensures enterprise clients see only their own
              company tickets, public status comments, and real-time SLA resolution countdowns.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 bg-slate-900/30 border-y border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              How the Automation Engine Works
            </h2>
            <p className="mt-2 text-xs text-slate-400">
              Three synchronized phases from intake to terminal archival.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <span className="font-mono text-xs font-bold text-indigo-400">01</span>
              <h4 className="mt-2 text-sm font-bold text-white">Intake &amp; Scoring</h4>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Tickets are created via customer portal or staff desk. SLA deadlines are calculated
                deterministically.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <span className="font-mono text-xs font-bold text-violet-400">02</span>
              <h4 className="mt-2 text-sm font-bold text-white">Live Monitoring &amp; Triage</h4>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Autonomous worker evaluates active tickets, flagging near-breach urgencies and
                escalating queues.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <span className="font-mono text-xs font-bold text-emerald-400">03</span>
              <h4 className="mt-2 text-sm font-bold text-white">Resolution &amp; Audit Lock</h4>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Reaching resolved halts the SLA clock; admin closure commits an immutable audit
                record.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Accounts Evaluation Section */}
      <section id="demo-accounts" className="py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" />
            Quick Test Drive
          </div>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">
            Pre-Configured Seed Accounts
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Test any user role with one click. Password for all accounts is:{" "}
            <code className="text-indigo-300 font-mono">Password123!</code>
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Admin */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <Shield className="h-5 w-5 text-rose-400" />
                <span className="text-[10px] font-bold uppercase text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded">
                  Admin
                </span>
              </div>
              <h4 className="mt-3 text-sm font-bold text-white">System Admin</h4>
              <p className="text-xs text-slate-400 truncate mt-0.5">admin@example.com</p>
              <p className="text-[11px] text-slate-500 mt-2">
                Operations triage, dispatching, priority overrides &amp; analytics.
              </p>
            </div>
            <button
              onClick={() => handleQuickLogin("admin@example.com", "admin")}
              disabled={!!loggingInRole}
              className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 transition-colors flex items-center justify-center gap-1.5"
            >
              {loggingInRole === "admin" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  Sign In as Admin
                  <ArrowRight className="h-3 w-3" />
                </>
              )}
            </button>
          </div>

          {/* Agent */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <UserCheck className="h-5 w-5 text-blue-400" />
                <span className="text-[10px] font-bold uppercase text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded">
                  Agent
                </span>
              </div>
              <h4 className="mt-3 text-sm font-bold text-white">Agent Sarah</h4>
              <p className="text-xs text-slate-400 truncate mt-0.5">agent.sarah@example.com</p>
              <p className="text-[11px] text-slate-500 mt-2">
                Assigned work queue, ticket investigation &amp; resolution.
              </p>
            </div>
            <button
              onClick={() => handleQuickLogin("agent.sarah@example.com", "agent")}
              disabled={!!loggingInRole}
              className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 transition-colors flex items-center justify-center gap-1.5"
            >
              {loggingInRole === "agent" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  Sign In as Agent
                  <ArrowRight className="h-3 w-3" />
                </>
              )}
            </button>
          </div>

          {/* Customer A */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <Building2 className="h-5 w-5 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                  Acme Corp
                </span>
              </div>
              <h4 className="mt-3 text-sm font-bold text-white">Alice (Customer)</h4>
              <p className="text-xs text-slate-400 truncate mt-0.5">customer.alice@acme.com</p>
              <p className="text-[11px] text-slate-500 mt-2">
                Isolated portal, live resolution meters &amp; ticket submission.
              </p>
            </div>
            <button
              onClick={() => handleQuickLogin("customer.alice@acme.com", "customerA")}
              disabled={!!loggingInRole}
              className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 transition-colors flex items-center justify-center gap-1.5"
            >
              {loggingInRole === "customerA" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  Sign In (Acme)
                  <ArrowRight className="h-3 w-3" />
                </>
              )}
            </button>
          </div>

          {/* Customer B */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <Building2 className="h-5 w-5 text-amber-400" />
                <span className="text-[10px] font-bold uppercase text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                  Globex Inc
                </span>
              </div>
              <h4 className="mt-3 text-sm font-bold text-white">Bob (Customer)</h4>
              <p className="text-xs text-slate-400 truncate mt-0.5">customer.bob@globex.com</p>
              <p className="text-[11px] text-slate-500 mt-2">
                Second isolated enterprise tenant demonstrating SQL privacy.
              </p>
            </div>
            <button
              onClick={() => handleQuickLogin("customer.bob@globex.com", "customerB")}
              disabled={!!loggingInRole}
              className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 transition-colors flex items-center justify-center gap-1.5"
            >
              {loggingInRole === "customerB" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  Sign In (Globex)
                  <ArrowRight className="h-3 w-3" />
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-16 border-t border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/60 to-slate-900 p-8 sm:p-10 shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Ready to Deliver Zero-Breach Support?
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
              Get started with the staff operations workspace or create an enterprise customer portal tenant today.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-500 transition-colors"
              >
                Sign In to Workspace
              </Link>
              <Link
                href="/register/customer"
                className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Customer Sign Up
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 text-xs text-slate-500 text-center">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-indigo-600 text-white flex items-center justify-center">
              <Clock className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-slate-300">SLA Engine</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-slate-300 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-slate-300 transition-colors">
              How It Works
            </a>
            <a href="#demo-accounts" className="hover:text-slate-300 transition-colors">
              Demo Accounts
            </a>
            <Link href="/login" className="hover:text-slate-300 transition-colors">
              Sign In
            </Link>
          </div>
          <p>© 2026 SLA Automation Engine.</p>
        </div>
      </footer>
    </div>
  );
}
