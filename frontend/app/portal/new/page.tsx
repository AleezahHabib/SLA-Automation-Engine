"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ticketsApi } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Role } from "@/types/enums";
import { ArrowLeft, Clock, Info, Send, ShieldAlert } from "lucide-react";

export default function CustomerNewTicketPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const subClean = subject.trim();
    const descClean = description.trim();

    if (!subClean) {
      setError("Please provide a ticket subject");
      return;
    }
    if (!descClean) {
      setError("Please describe your issue or request in detail");
      return;
    }

    setIsSubmitting(true);
    try {
      const ticket = await ticketsApi.create({
        subject: subClean,
        description: descClean,
      });
      router.push(`/portal/tickets/${ticket.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create support ticket. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Submit Support Request"
      subtitle="Open a new ticket with automatic priority triage"
      allowedRoles={[Role.CUSTOMER]}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Tickets
        </Link>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Raise a Support Ticket</CardTitle>
            <CardDescription>
              Our automated engine analyzes your issue description to establish priority and assign an SLA deadline guarantee.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Ticket Subject"
                placeholder="e.g. Production API throwing 500 errors during checkout"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                hint="Summarize the core problem concisely (keywords like outage, urgent, typo help establish triage)."
              />

              <Textarea
                label="Detailed Description"
                placeholder="Provide steps to reproduce, affected services, error messages, and context..."
                required
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                hint="You will be able to attach diagnostic logs, screenshots, and PDFs once the ticket is created."
              />

              {/* Automated SLA Triage Info Callout */}
              <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/30 text-xs text-indigo-900 dark:text-indigo-200">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-indigo-950 dark:text-indigo-100">
                      SLA Response Guarantee
                    </h4>
                    <p className="mt-1 text-slate-600 dark:text-slate-300 leading-relaxed">
                      Critical outages receive a guaranteed 2-hour response window, high priority issues 8 hours, and general inquiries 24 to 72 hours.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Link href="/portal">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" isLoading={isSubmitting} size="lg">
                  <Send className="mr-2 h-4 w-4" />
                  Submit Request
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
