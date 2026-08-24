"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { customersApi, ticketsApi } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { CustomerSummary } from "@/types/api";
import { Role } from "@/types/enums";
import { ArrowLeft, Clock, Info, Send, UserPlus } from "lucide-react";

export default function StaffNewTicketPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSelectableCustomers = async () => {
      try {
        const list = await customersApi.selectable();
        setCustomers(list);
        if (list.length > 0) {
          setSelectedCustomerId(list[0].id);
        }
      } catch (err) {
        console.error("Failed to load customer list:", err);
      } finally {
        setIsLoadingCustomers(false);
      }
    };
    loadSelectableCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedCustomerId) {
      setError("Please select a customer account");
      return;
    }
    const subClean = subject.trim();
    const descClean = description.trim();

    if (!subClean) {
      setError("Ticket subject is required");
      return;
    }
    if (!descClean) {
      setError("Ticket description is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const ticket = await ticketsApi.create({
        customer_id: selectedCustomerId,
        subject: subClean,
        description: descClean,
      });
      router.push(`/tickets/${ticket.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create ticket");
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Create Support Ticket"
      subtitle="Staff intake on behalf of customer"
      allowedRoles={[Role.ADMIN, Role.AGENT]}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          href="/tickets"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Tickets
        </Link>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">New Ticket Intake</CardTitle>
            <CardDescription>
              Submit an issue raised via phone, chat, or email. The engine will evaluate the description, assign deterministic priority, and initiate the SLA timer.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Customer Selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                  Customer Account
                </label>
                {isLoadingCustomers ? (
                  <div className="h-10 rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />
                ) : customers.length === 0 ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    No active customers found. Please create a customer account first in{" "}
                    <Link href="/customers" className="underline font-semibold">
                      Customers Management
                    </Link>
                    .
                  </div>
                ) : (
                  <Select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    options={customers.map((c) => ({
                      value: c.id,
                      label: `${c.name} (${c.email})`,
                    }))}
                  />
                )}
              </div>

              <Input
                label="Ticket Subject"
                placeholder="e.g. Critical outage on database cluster"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />

              <Textarea
                label="Detailed Description"
                placeholder="Paste logs, describe caller symptoms, reproduction steps..."
                required
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              {/* Triage Info */}
              <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/30 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-3">
                <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-indigo-950 dark:text-indigo-100">
                    Automated Priority Triage
                  </h4>
                  <p className="mt-1 text-slate-600 dark:text-slate-300 leading-relaxed">
                    Priority is computed automatically on creation using keyword triage rules (Critical 2h, High 8h, Medium 24h, Low 72h). Administrators can override priority subsequently from the ticket detail view.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Link href="/tickets">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" isLoading={isSubmitting} size="lg">
                  <Send className="mr-2 h-4 w-4" />
                  Create Ticket
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
