"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { agentsApi, ticketsApi } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { SlaBadge } from "@/components/sla/SlaBadge";
import { formatDate } from "@/lib/utils";
import {
  AgentSummary,
  PaginationEnvelope,
  TicketListItem,
  TicketSummaryCounts,
} from "@/types/api";
import { Priority, Role, TicketStatus } from "@/types/enums";
import {
  AlertCircle,
  Inbox,
  Loader2,
  PlusCircle,
  Search,
  Ticket as TicketIcon,
  Users,
} from "lucide-react";

function TicketsDashboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [summary, setSummary] = useState<TicketSummaryCounts | null>(null);
  const [ticketData, setTicketData] = useState<PaginationEnvelope<TicketListItem> | null>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters from URL or state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assignedAgentFilter, setAssignedAgentFilter] = useState<string>(
    searchParams.get("assigned_agent_id") || "all"
  );
  const [myQueueOnly, setMyQueueOnly] = useState<boolean>(
    searchParams.get("assigned_to_me") === "true"
  );
  const [unassignedOnly, setUnassignedOnly] = useState<boolean>(
    searchParams.get("unassigned") === "true"
  );
  const [breachedOnly, setBreachedOnly] = useState<boolean>(
    searchParams.get("breached") === "true"
  );
  const [sortBy, setSortBy] = useState<string>("sla_deadline");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const isAdmin = user?.role === Role.ADMIN;
  const isAgent = user?.role === Role.AGENT;

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      let statuses: string[] | undefined = undefined;
      if (statusFilter === "active") {
        statuses = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED];
      } else if (statusFilter !== "all") {
        statuses = [statusFilter];
      }

      const priorities = priorityFilter !== "all" ? [priorityFilter] : undefined;

      const [sumRes, listRes] = await Promise.all([
        ticketsApi.summary(),
        ticketsApi.list({
          page,
          page_size: 25,
          status: statuses,
          priority: priorities,
          assigned_agent_id:
            assignedAgentFilter !== "all" && !myQueueOnly && !unassignedOnly
              ? assignedAgentFilter
              : undefined,
          assigned_to_me: myQueueOnly ? true : undefined,
          unassigned: unassignedOnly ? true : undefined,
          breached: breachedOnly ? true : undefined,
          search: search || undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
        }),
      ]);

      setSummary(sumRes);
      setTicketData(listRes);

      if (isAdmin && agents.length === 0) {
        const agentList = await agentsApi.list();
        setAgents(agentList);
      }
    } catch (err) {
      console.error("Failed to load tickets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [
    page,
    statusFilter,
    priorityFilter,
    assignedAgentFilter,
    myQueueOnly,
    unassignedOnly,
    breachedOnly,
    sortBy,
    sortOrder,
  ]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDashboardData();
  };

  const openCount = summary?.by_status[TicketStatus.OPEN] || 0;
  const inProgressCount = summary?.by_status[TicketStatus.IN_PROGRESS] || 0;
  const resolvedCount = summary?.by_status[TicketStatus.RESOLVED] || 0;
  const closedCount = summary?.by_status[TicketStatus.CLOSED] || 0;
  const breachedCount = summary?.breached ?? 0;
  const unassignedCount = summary?.unassigned ?? 0;
  const isBreachedActive = breachedOnly;
  const isUnassignedActive = unassignedOnly;
  const isOpenActive = !breachedOnly && !unassignedOnly && statusFilter === TicketStatus.OPEN;
  const isInProgressActive = !breachedOnly && !unassignedOnly && statusFilter === TicketStatus.IN_PROGRESS;
  const isResolvedActive = !breachedOnly && !unassignedOnly && statusFilter === TicketStatus.RESOLVED;
  const isClosedActive = !breachedOnly && !unassignedOnly && statusFilter === TicketStatus.CLOSED;

  return (
    <AppShell
      title="Support Tickets Operations Desk"
      subtitle={
        isAdmin
          ? "Organization-wide triage, dispatching, SLA tracking, and audit monitoring"
          : "Work your assigned queue and pick up unassigned incoming tickets"
      }
      allowedRoles={[Role.ADMIN, Role.AGENT]}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TicketIcon className="h-5 w-5 text-indigo-600" />
              {isBreachedActive
                ? "Breached & Overdue Tickets"
                : isUnassignedActive
                ? "Unassigned Intake Pool"
                : isOpenActive
                ? "Open Tickets"
                : isInProgressActive
                ? "In Progress Tickets"
                : isResolvedActive
                ? "Resolved Tickets"
                : isClosedActive
                ? "Closed Tickets"
                : myQueueOnly
                ? "My Assigned Work Queue"
                : "Active Ticket Operations"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing tickets ordered by SLA deadline urgency.
            </p>
          </div>
        </div>

        {/* Operational KPI Metric Cards (Mutually Exclusive Single Selection) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card
            onClick={() => {
              if (isBreachedActive) {
                setBreachedOnly(false);
                setStatusFilter("active");
              } else {
                setBreachedOnly(true);
                setUnassignedOnly(false);
                setMyQueueOnly(false);
                setStatusFilter("all");
                setPriorityFilter("all");
              }
              setPage(1);
            }}
            className={`cursor-pointer transition-all border-l-4 border-l-rose-500 ${
              isBreachedActive
                ? "ring-2 ring-rose-500 shadow-md bg-rose-50/30 dark:bg-rose-950/30"
                : "hover:border-slate-300"
            }`}
          >
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> SLA Breached
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <p className="text-2xl font-bold text-rose-600">{breachedCount}</p>
            </CardContent>
          </Card>

          {isAdmin && (
            <Card
              onClick={() => {
                if (isUnassignedActive) {
                  setUnassignedOnly(false);
                  setStatusFilter("active");
                } else {
                  setUnassignedOnly(true);
                  setBreachedOnly(false);
                  setMyQueueOnly(false);
                  setStatusFilter("active");
                  setAssignedAgentFilter("all");
                }
                setPage(1);
              }}
              className={`cursor-pointer transition-all border-l-4 border-l-orange-500 ${
                isUnassignedActive
                  ? "ring-2 ring-orange-500 shadow-md bg-orange-50/30 dark:bg-orange-950/30"
                  : "hover:border-slate-300"
              }`}
            >
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-orange-600 flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> Unassigned
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <p className="text-2xl font-bold text-orange-600">{unassignedCount}</p>
              </CardContent>
            </Card>
          )}

          <Card
            onClick={() => {
              if (isOpenActive) {
                setStatusFilter("active");
              } else {
                setStatusFilter(TicketStatus.OPEN);
                setBreachedOnly(false);
                setUnassignedOnly(false);
                setMyQueueOnly(false);
              }
              setPage(1);
            }}
            className={`cursor-pointer transition-all border-l-4 border-l-blue-500 ${
              isOpenActive
                ? "ring-2 ring-blue-500 shadow-md bg-blue-50/30 dark:bg-blue-950/30"
                : "hover:border-slate-300"
            }`}
          >
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                Open
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{openCount}</p>
            </CardContent>
          </Card>

          <Card
            onClick={() => {
              if (isInProgressActive) {
                setStatusFilter("active");
              } else {
                setStatusFilter(TicketStatus.IN_PROGRESS);
                setBreachedOnly(false);
                setUnassignedOnly(false);
                setMyQueueOnly(false);
              }
              setPage(1);
            }}
            className={`cursor-pointer transition-all border-l-4 border-l-amber-500 ${
              isInProgressActive
                ? "ring-2 ring-amber-500 shadow-md bg-amber-50/30 dark:bg-amber-950/30"
                : "hover:border-slate-300"
            }`}
          >
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{inProgressCount}</p>
            </CardContent>
          </Card>

          <Card
            onClick={() => {
              if (isResolvedActive) {
                setStatusFilter("active");
              } else {
                setStatusFilter(TicketStatus.RESOLVED);
                setBreachedOnly(false);
                setUnassignedOnly(false);
                setMyQueueOnly(false);
              }
              setPage(1);
            }}
            className={`cursor-pointer transition-all border-l-4 border-l-emerald-500 ${
              isResolvedActive
                ? "ring-2 ring-emerald-500 shadow-md bg-emerald-50/30 dark:bg-emerald-950/30"
                : "hover:border-slate-300"
            }`}
          >
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
                Resolved
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{resolvedCount}</p>
            </CardContent>
          </Card>

          <Card
            onClick={() => {
              if (isClosedActive) {
                setStatusFilter("active");
              } else {
                setStatusFilter(TicketStatus.CLOSED);
                setBreachedOnly(false);
                setUnassignedOnly(false);
                setMyQueueOnly(false);
              }
              setPage(1);
            }}
            className={`cursor-pointer transition-all border-l-4 border-l-slate-400 ${
              isClosedActive
                ? "ring-2 ring-slate-500 shadow-md bg-slate-100/50 dark:bg-slate-800/50"
                : "hover:border-slate-300"
            }`}
          >
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Closed
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{closedCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search subject or reference (e.g. TKT-000001)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Search
            </Button>
          </form>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="active">Status: Active Only</option>
              <option value="all">Status: All (Inc. Closed)</option>
              <option value={TicketStatus.OPEN}>Status: Open</option>
              <option value={TicketStatus.IN_PROGRESS}>Status: In Progress</option>
              <option value={TicketStatus.RESOLVED}>Status: Resolved</option>
              <option value={TicketStatus.CLOSED}>Status: Closed</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">Priority: All</option>
              <option value={Priority.CRITICAL}>Critical (2h)</option>
              <option value={Priority.HIGH}>High (8h)</option>
              <option value={Priority.MEDIUM}>Medium (24h)</option>
              <option value={Priority.LOW}>Low (72h)</option>
            </select>

            {isAdmin && (
              <select
                value={
                  myQueueOnly
                    ? "mine"
                    : unassignedOnly
                    ? "unassigned"
                    : assignedAgentFilter
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "mine") {
                    setMyQueueOnly(true);
                    setUnassignedOnly(false);
                    setAssignedAgentFilter("all");
                  } else if (val === "unassigned") {
                    setUnassignedOnly(true);
                    setMyQueueOnly(false);
                    setAssignedAgentFilter("all");
                  } else {
                    setMyQueueOnly(false);
                    setUnassignedOnly(false);
                    setAssignedAgentFilter(val);
                  }
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">Assignee: All</option>
                <option value="unassigned">Assignee: Unassigned Pool</option>
                <option value="mine">Assignee: Assigned to Me</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    Agent: {a.full_name}
                  </option>
                ))}
              </select>
            )}

            {isAgent && (
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  onClick={() => {
                    setMyQueueOnly(false);
                    setUnassignedOnly(false);
                    setPage(1);
                  }}
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    !myQueueOnly && !unassignedOnly
                      ? "bg-white dark:bg-slate-900 shadow-sm text-indigo-600"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  All Visible
                </button>
                <button
                  onClick={() => {
                    setMyQueueOnly(true);
                    setUnassignedOnly(false);
                    setPage(1);
                  }}
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    myQueueOnly
                      ? "bg-white dark:bg-slate-900 shadow-sm text-indigo-600"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  My Queue
                </button>
                <button
                  onClick={() => {
                    setUnassignedOnly(true);
                    setMyQueueOnly(false);
                    setPage(1);
                  }}
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    unassignedOnly
                      ? "bg-white dark:bg-slate-900 shadow-sm text-indigo-600"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Unassigned
                </button>
              </div>
            )}

            <select
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [f, o] = e.target.value.split(":");
                setSortBy(f);
                setSortOrder(o as "asc" | "desc");
                setPage(1);
              }}
              className="h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="sla_deadline:asc">Sort: SLA Urgency (Earliest First)</option>
              <option value="updated_at:desc">Sort: Recently Updated</option>
              <option value="created_at:desc">Sort: Recently Created</option>
              <option value="priority:asc">Sort: Priority</option>
              <option value="status:asc">Sort: Status</option>
            </select>
          </div>
        </div>

        {/* Ticket List Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
                <p className="text-xs">Loading operational tickets...</p>
              </div>
            ) : !ticketData || ticketData.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Inbox className="h-10 w-10 text-slate-400 mb-3 stroke-[1.5]" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  No tickets match current filters
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                  Try clearing your search query, priority filter, or status scoping.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/60 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Ref</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Assignee</th>
                      <th className="py-3 px-4">SLA Response Time</th>
                      <th className="py-3 px-4">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {ticketData.items.map((ticket) => (
                      <tr
                        key={ticket.id}
                        onClick={() => router.push(`/tickets/${ticket.id}`)}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${
                          ticket.sla_breached && ticket.status !== TicketStatus.CLOSED
                            ? "bg-rose-50/30 dark:bg-rose-950/20"
                            : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {ticket.reference}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {ticket.customer.name}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                            {ticket.customer.email}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100 max-w-sm truncate">
                          {ticket.subject}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge status={ticket.status} size="sm" />
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge priority={ticket.priority} size="sm" />
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {ticket.assigned_agent ? (
                            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {ticket.assigned_agent.full_name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 font-semibold text-[11px] bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded">
                              Unassigned
                            </span>
                          )}
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
                        <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                          {formatDate(ticket.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
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

export default function TicketsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      }
    >
      <TicketsDashboardContent />
    </Suspense>
  );
}
