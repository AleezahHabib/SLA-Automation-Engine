"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Role } from "@/types/enums";
import { Clock, ArrowRight, Menu, X, Shield, Sparkles } from "lucide-react";

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
    if (user.role === Role.CUSTOMER) return "Go to Portal";
    return "Go to Workspace";
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-slate-950/80 backdrop-blur-lg border-b border-slate-800/80 shadow-lg shadow-black/20 py-3.5"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform">
              <Clock className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
                SLA Engine
              </span>
              <span className="inline-flex items-center rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/20">
                v1.0
              </span>
            </div>
          </Link>

          {/* Center Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              How It Works
            </a>
            <a
              href="#portals"
              className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              Portals &amp; Roles
            </a>
            <a
              href="#demo-accounts"
              className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              Demo Accounts
            </a>
          </div>

          {/* Right Action CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {!isLoading && isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-300 font-medium">
                  {user.full_name || user.email}
                </span>
                <Link
                  href={getDashboardLink()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
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
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  Customer Sign Up
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-500 transition-all"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Launch App
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
                Features
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                How It Works
              </a>
              <a
                href="#portals"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Portals &amp; Roles
              </a>
              <a
                href="#demo-accounts"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Demo Accounts
              </a>
              <div className="mt-2 pt-3 border-t border-slate-800 flex flex-col gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-md"
                >
                  Sign In
                </Link>
                <Link
                  href="/register/customer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-200"
                >
                  Customer Sign Up
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
