"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Role } from "@/types/enums";
import { Clock, Shield, Sparkles, User, ArrowRight, Menu, X, CheckCircle2 } from "lucide-react";

export function LandingNav() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getDashboardLink = () => {
    if (!user) return "/login";
    if (user.role === Role.CUSTOMER) return "/portal";
    return "/tickets";
  };

  const getDashboardLabel = () => {
    if (!user) return "Sign In";
    if (user.role === Role.CUSTOMER) return "Open Customer Portal";
    return "Open Support Desk";
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 shadow-lg shadow-black/20 py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo & Platform Name */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Clock className="h-5 w-5 animate-pulse-subtle" />
              <div className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
                  SLA Automation Engine
                </span>
                <span className="hidden sm:inline-flex items-center rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/20">
                  v1.0 Live
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-normal">
                Autonomous Support Intelligence
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-7">
            <a
              href="#features"
              className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              Engine Features
            </a>
            <a
              href="#simulator"
              className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              Live SLA Simulator
            </a>
            <a
              href="#state-machine"
              className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              Lifecycle State Machine
            </a>
            <a
              href="#demo-credentials"
              className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              Demo Accounts
            </a>
            <a
              href="#architecture"
              className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              Architecture
            </a>
          </div>

          {/* Right Action CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {!isLoading && isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/90 px-3 py-1 text-xs text-slate-300">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  <span className="font-medium text-slate-200">{user.full_name || user.email}</span>
                  <span className="text-[10px] uppercase font-semibold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                    {user.role}
                  </span>
                </div>
                <Link
                  href={getDashboardLink()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 hover:from-indigo-500 hover:to-violet-500 transition-all hover:scale-[1.02]"
                >
                  {getDashboardLabel()}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register/customer"
                  className="rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-800 transition-colors"
                >
                  Customer Portal
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 hover:from-indigo-500 hover:to-violet-500 transition-all hover:scale-[1.02]"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
                  Launch Workspace
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 rounded-2xl border border-slate-800 bg-slate-900/95 p-4 shadow-xl backdrop-blur-xl">
            <div className="flex flex-col gap-2.5">
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Engine Features
              </a>
              <a
                href="#simulator"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Live SLA Simulator
              </a>
              <a
                href="#state-machine"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Lifecycle State Machine
              </a>
              <a
                href="#demo-credentials"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Demo Accounts
              </a>
              <a
                href="#architecture"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Architecture
              </a>
              <div className="mt-2 pt-3 border-t border-slate-800 flex flex-col gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-md"
                >
                  Sign In to Workspace
                </Link>
                <Link
                  href="/register/customer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-200"
                >
                  Register Customer Portal
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
