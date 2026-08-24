"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Role } from "@/types/enums";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Clock, Shield, Sparkles, User, UserCheck } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const user = await login(email, password);
      if (user.role === Role.CUSTOMER) {
        router.push("/portal");
      } else {
        router.push("/tickets");
      }
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Password123!");
    setError(null);
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-950 px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30">
          <Clock className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
          SLA Automation Engine
        </h2>
        <p className="mt-1.5 text-xs text-slate-400">
          Sign in to your support desk or customer portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="mb-5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-medium text-rose-400 animate-in fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />

            <Input
              label="Password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            <Button
              type="submit"
              className="w-full mt-2"
              isLoading={isLoading}
              size="lg"
            >
              Sign In
            </Button>
          </form>

          {/* Quick Fill Demo Credentials */}
          <div className="mt-6 border-t border-slate-800 pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              Quick-Fill Demo Accounts
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill("admin@example.com")}
                className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-left hover:border-indigo-500/40 hover:bg-slate-800 transition-colors"
              >
                <Shield className="h-4 w-4 text-rose-400 shrink-0" />
                <div className="truncate">
                  <p className="text-xs font-medium text-slate-200">Admin</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    admin@example.com
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("agent.sarah@example.com")}
                className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-left hover:border-indigo-500/40 hover:bg-slate-800 transition-colors"
              >
                <UserCheck className="h-4 w-4 text-blue-400 shrink-0" />
                <div className="truncate">
                  <p className="text-xs font-medium text-slate-200">Agent</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    agent.sarah@example.com
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("customer.alice@acme.com")}
                className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-left hover:border-indigo-500/40 hover:bg-slate-800 transition-colors"
              >
                <User className="h-4 w-4 text-emerald-400 shrink-0" />
                <div className="truncate">
                  <p className="text-xs font-medium text-slate-200">Customer A</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    Acme Corp
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("customer.bob@globex.com")}
                className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-left hover:border-indigo-500/40 hover:bg-slate-800 transition-colors"
              >
                <User className="h-4 w-4 text-emerald-400 shrink-0" />
                <div className="truncate">
                  <p className="text-xs font-medium text-slate-200">Customer B</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    Globex Inc
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Links */}
          <div className="mt-6 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-4">
            <Link
              href="/register/customer"
              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Register Customer Portal
            </Link>
            <Link
              href="/register"
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              Staff Registration
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
