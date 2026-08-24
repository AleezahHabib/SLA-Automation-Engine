"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ticketsApi } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SlaBadge } from "@/components/sla/SlaBadge";
import { formatDate } from "@/lib/utils";
import { PaginationEnvelope, TicketListItem, TicketSummaryCounts } from "@/types/api";
import { Role, TicketStatus } from "@/types/enums";
import {
  CheckCircle2,
  Clock,
  Filter,
  Inbox,
  Loader2,
  PlusCircle,
  Search,
  Ticket as TicketIcon,
} from "lucide-react";

export default function CustomerPortalPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [summary, setSummary] = useState<TicketSummaryCounts | null>(null);
  const [ticketData, setTicketData] = useState<PaginationEnvelope<TicketListItem> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const fetchPortalData = async () => {
    setIsLoading(true);
    try {
      const [sumRes, listRes] = await Promise.all([
        ticketsApi.summary(),
        ticketsApi.list({
          page,
          page_size: 25,
          search: search || undefined,
          status: statusFilter !== "all" ? [statusFilter] : undefined,
          sort_by: "sla_deadline",
          sort_order: "asc",
        }),
      ]);
      setSummary(sumRes);
      setTicketData(listRes);
    } catch (err) {
      console.error("Failed to fetch customer tickets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPortalData();
  };

  const openCount = summary?.by_status[TicketStatus.OPEN] || 0;
  const inProgressCount = summary?.by_status[TicketStatus.IN_PROGRESS] || 0;
  const resolvedCount = summary?.by_status[TicketStatus.RESOLVED] || 0;
  const closedCount = summary?.by_status[TicketStatus.CLOSED] || 0;
  const activeTotal = openCount + inProgressCount;

  return (
    <AppShell
      title="Customer Support Portal"
      subtitle={user?.customer_name ? `Support workspace for ${user.customer_name}` : "Manage and track your support tickets"}
      allowedRoles={[Role.CUSTOMER]}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              My Support Requests
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All tickets are triaged automatically with active SLA response timers.
            </p>
          </div>
          <Link href="/portal/new">
            <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20">
              <PlusCircle className="mr-2 h-4 w-4" />
              Raise New Ticket
            </Button>
          </Link>
        </div>

        {/* Customer Status Summary Cards (Omit breach stats per spec 14) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Open Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {openCount}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {inProgressCount}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Resolved
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {resolvedCount}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-slate-400">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Closed Archive
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {closedCount}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by subject or reference (e.g. TKT-000001)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <Button type="submit" variant="secondary" size="md">
              Search
            </Button>
          </form>

          <div className="flex items-center gap-2 sm:w-48">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "Active Tickets (Default)" },
                { value: TicketStatus.OPEN, label: "Status: Open" },
                { value: TicketStatus.IN_PROGRESS, label: "Status: In Progress" },
                { value: TicketStatus.RESOLVED, label: "Status: Resolved" },
                { value: TicketStatus.CLOSED, label: "Status: Closed" },
              ]}
            />
          </div>
        </div>

        {/* Ticket List Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
                <p className="text-xs">Loading tickets...</p>
              </div>
            ) : !ticketData || ticketData.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Inbox className="h-10 w-10 text-slate-400 mb-3 stroke-[1.5]" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  No support tickets found
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                  {search || statusFilter !== "all"
                    ? "Try adjusting your search query or status filter."
                    : "You do not have any active support tickets. Need help? Raise a new request."}
                </p>
                <Link href="/portal/new" className="mt-4">
                  <Button size="sm">Raise Ticket</Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/60 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Reference</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">SLA Guarantee</th>
                      <th className="py-3 px-4">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {ticketData.items.map((ticket) => (
                      <tr
                        key={ticket.id}
                        onClick={() => router.push(`/portal/tickets/${ticket.id}`)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                          {ticket.reference}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100 max-w-md truncate">
                          {ticket.subject}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge status={ticket.status} size="sm" />
                        </td>
                        <td className="py-3.5 px-4">
                          <SlaBadge
                            createdAt={ticket.created_at}
                            deadline={ticket.sla_deadline}
                            status={ticket.status}
                            priority={ticket.priority}
                            isBreached={ticket.sla_breached}
                          />
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(ticket.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {ticketData && ticketData.total_pages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800 text-xs">
                <span className="text-slate-500">
                  Showing {(page - 1) * ticketData.page_size + 1} to{" "}
                  {Math.min(page * ticketData.page_size, ticketData.total)} of{" "}
                  {ticketData.total} tickets
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= ticketData.total_pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
