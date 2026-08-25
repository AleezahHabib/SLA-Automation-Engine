"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Role } from "@/types/enums";
import {
  Shield,
  UserCheck,
  Building2,
  Sparkles,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Lock,
  Copy,
  Check,
} from "lucide-react";

interface DemoAccount {
  role: string;
  roleBadge: string;
  badgeColor: string;
  name: string;
  email: string;
  password: string;
  tenant: string;
  description: string;
  capabilities: string[];
  icon: React.ElementType;
  iconBg: string;
  targetPath: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: "Admin",
    roleBadge: "Operational Owner",
    badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    name: "System Administrator",
    email: "admin@example.com",
    password: "Password123!",
    tenant: "Global Organization",
    description: "Full control over ticket dispatching, agent workload balancing, customer management, metrics, and priority overrides.",
    capabilities: [
      "Override SLA Priority & Durations",
      "Terminal Ticket Closure ('resolved' ➔ 'closed')",
      "Company & Customer Tenant Admin",
      "Organization-wide SLA Metrics & MTTR Analytics",
    ],
    icon: Shield,
    iconBg: "from-rose-600 to-red-700",
    targetPath: "/tickets",
  },
  {
    role: "Agent",
    roleBadge: "Support Staff",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    name: "Agent Sarah Connor",
    email: "agent.sarah@example.com",
    password: "Password123!",
    tenant: "Staff Workspace",
    description: "Dedicated support triage queue with active countdown meters, internal team discussions, and status transitions.",
    capabilities: [
      "Assigned Queue & At-Risk Ticket Alerts",
      "Linear Lifecycle Transitions ('open' ➔ 'in_progress' ➔ 'resolved')",
      "Internal Private Staff Notes & Comments",
      "Attachment Uploads & Investigation History",
    ],
    icon: UserCheck,
    iconBg: "from-blue-600 to-indigo-700",
    targetPath: "/tickets",
  },
  {
    role: "Customer A",
    roleBadge: "Tenant: Acme Corp",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    name: "Alice Vandermeer",
    email: "customer.alice@acme.com",
    password: "Password123!",
    tenant: "Acme Corp (Isolated SQL Tenant)",
    description: "Self-service client portal with live SLA deadline clocks, transparent resolution progress, and ticket submission.",
    capabilities: [
      "Strict Tenant-Isolated View (Acme Corp only)",
      "Real-time SLA Countdown Progress",
      "Self-Service Ticket Intake & Attachments",
      "Customer-visible Comments & Updates",
    ],
    icon: Building2,
    iconBg: "from-emerald-600 to-teal-700",
    targetPath: "/portal",
  },
  {
    role: "Customer B",
    roleBadge: "Tenant: Globex Inc",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    name: "Bob Robertson",
    email: "customer.bob@globex.com",
    password: "Password123!",
    tenant: "Globex Inc (Isolated SQL Tenant)",
    description: "Second isolated enterprise tenant showcasing strict multi-tenant boundary enforcement at the database query layer.",
    capabilities: [
      "Strict Tenant-Isolated View (Globex Inc only)",
      "Zero Cross-Tenant Data Leakage Guarantee",
      "Direct Support Ticket Creation",
      "Live Resolution Clock Tracking",
    ],
    icon: Building2,
    iconBg: "from-amber-600 to-orange-700",
    targetPath: "/portal",
  },
];

export function DemoCredentialsSection() {
  const { login } = useAuth();
  const router = useRouter();
  const [loggingInEmail, setLoggingInEmail] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOneClickLogin = async (account: DemoAccount) => {
    setError(null);
    setLoggingInEmail(account.email);
    try {
      const user = await login(account.email, account.password);
      if (user.role === Role.CUSTOMER) {
        router.push("/portal");
      } else {
        router.push("/tickets");
      }
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please verify backend is running.");
      setLoggingInEmail(null);
    }
  };

  const copyCredential = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(text);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  return (
    <section id="demo-credentials" className="py-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400">
            <Sparkles className="h-3.5 w-3.5" />
            Instant Evaluation Launchpad
          </div>
          <h2 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Pre-Configured Demonstration Accounts
          </h2>
          <p className="mt-3 text-base text-slate-400">
            Test drive every role and boundary with one click. Explore the staff triage desks,
            admin governance controls, and isolated multi-tenant customer portals.
          </p>
        </div>

        {error && (
          <div className="mt-6 max-w-md mx-auto rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-center text-xs font-medium text-rose-300">
            {error}
          </div>
        )}

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {DEMO_ACCOUNTS.map((acc) => {
            const Icon = acc.icon;
            const isLoggingIn = loggingInEmail === acc.email;

            return (
              <div
                key={acc.email}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 flex flex-col justify-between hover:border-slate-700 hover:bg-slate-900 transition-all duration-200 group shadow-xl backdrop-blur-md relative overflow-hidden"
              >
                {/* Glow accent */}
                <div className="absolute top-0 right-0 h-24 w-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />

                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div
                      className={`h-11 w-11 rounded-xl bg-gradient-to-tr ${acc.iconBg} text-white flex items-center justify-center shadow-md`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${acc.badgeColor}`}
                    >
                      {acc.role}
                    </span>
                  </div>

                  <h3 className="mt-4 text-base font-bold text-white">{acc.name}</h3>
                  <p className="text-xs text-indigo-400 font-medium">{acc.tenant}</p>

                  <p className="mt-3 text-xs text-slate-400 leading-relaxed">{acc.description}</p>

                  {/* Capabilities Bullet Points */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                    {acc.capabilities.map((cap, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{cap}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800">
                  {/* Email & Password pill */}
                  <div className="rounded-lg bg-slate-950/80 p-2.5 border border-slate-800 text-[11px] font-mono space-y-1 mb-4">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="truncate">{acc.email}</span>
                      <button
                        onClick={() => copyCredential(acc.email)}
                        className="text-slate-500 hover:text-slate-200 p-0.5"
                        title="Copy email"
                      >
                        {copiedEmail === acc.email ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="text-slate-500 flex items-center justify-between">
                      <span>Password: Password123!</span>
                    </div>
                  </div>

                  {/* 1-Click Launch Button */}
                  <button
                    type="button"
                    onClick={() => handleOneClickLogin(acc)}
                    disabled={isLoggingIn || !!loggingInEmail}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/25 hover:from-indigo-500 hover:to-violet-500 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Authenticating...
                      </>
                    ) : (
                      <>
                        Launch as {acc.role}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
