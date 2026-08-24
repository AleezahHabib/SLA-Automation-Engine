"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { agentsApi } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { AgentWorkload } from "@/types/api";
import { Role, TicketStatus } from "@/types/enums";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  Shield,
  UserCheck,
  Users,
} from "lucide-react";

export default function AgentsWorkloadPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [workloads, setWorkloads] = useState<AgentWorkload[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWorkloads = async () => {
    setIsLoading(true);
    try {
      const data = await agentsApi.workload();
      setWorkloads(data);
    } catch (err) {
      console.error("Failed to load agent workloads:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkloads();
  }, []);

  const totalAssigned = workloads.reduce((sum, a) => sum + a.assigned_total, 0);
  const totalBreached = workloads.reduce((sum, a) => sum + a.breached_count, 0);

  return (
    <AppShell
      title="Agent Workload & Dispatch Desk"
      subtitle="Live distribution of assigned support queues, capacity, and active SLA breaches"
      allowedRoles={[Role.ADMIN]}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-indigo-600" />
              Specialist Roster & Capacity
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real-time snapshot computed using aggregate SQL filter metrics.
            </p>
          </div>
          <Link href="/tickets?unassigned=true">
            <Button variant="outline" size="sm">
              <Inbox className="mr-1.5 h-4 w-4 text-orange-500" />
              View Unassigned Pool
            </Button>
          </Link>
        </div>

        {/* High-level KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-indigo-500">
            <CardHeader className="p-4 pb-1">
              <CardTitle className="text-xs font-semibold text-slate-500">
                Active Staff Agents
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {workloads.length}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="p-4 pb-1">
              <CardTitle className="text-xs font-semibold text-slate-500">
                Total Assigned Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {totalAssigned}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-rose-500">
            <CardHeader className="p-4 pb-1">
              <CardTitle className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> Total Active Breaches
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold text-rose-600">{totalBreached}</p>
            </CardContent>
          </Card>
        </div>

        {/* Workload Cards / Table */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-semibold">
              Per-Agent Queue Distribution
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
                <p className="text-xs">Computing workload statistics...</p>
              </div>
            ) : workloads.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No active staff agents found. Register staff agents to enable dispatch.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/60 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Agent Name</th>
                      <th className="py-3.5 px-4">Total Assigned</th>
                      <th className="py-3.5 px-4">Open</th>
                      <th className="py-3.5 px-4">In Progress</th>
                      <th className="py-3.5 px-4">Resolved</th>
                      <th className="py-3.5 px-4">Closed</th>
                      <th className="py-3.5 px-4">Breached (Active)</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {workloads.map((w) => (
                      <tr
                        key={w.agent_id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            {w.agent_name}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                          {w.assigned_total}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="rounded bg-blue-50 text-blue-700 px-2 py-0.5 font-medium">
                            {w.by_status[TicketStatus.OPEN] || 0}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="rounded bg-amber-50 text-amber-700 px-2 py-0.5 font-medium">
                            {w.by_status[TicketStatus.IN_PROGRESS] || 0}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 font-medium">
                            {w.by_status[TicketStatus.RESOLVED] || 0}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {w.by_status[TicketStatus.CLOSED] || 0}
                        </td>
                        <td className="py-3.5 px-4">
                          {w.breached_count > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 px-2 py-0.5 font-bold">
                              <AlertCircle className="h-3 w-3" /> {w.breached_count} Overdue
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link href={`/tickets?assigned_agent_id=${w.agent_id}`}>
                            <Button variant="ghost" size="sm">
                              Inspect Queue <ArrowRight className="ml-1 h-3 w-3" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
