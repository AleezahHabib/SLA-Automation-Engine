"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { metricsApi } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import {
  MetricsByAgentItem,
  MetricsByPriorityItem,
  MetricsSummary,
  TimeseriesResponse,
} from "@/types/api";
import { Priority, Role } from "@/types/enums";
import { formatDate } from "@/lib/utils";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Gauge,
  Layers,
  LineChart as LineChartIcon,
  Loader2,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type PresetRange = "24h" | "7d" | "30d" | "90d";

export default function MetricsPage() {
  const { user } = useAuth();

  const [preset, setPreset] = useState<PresetRange>("7d");
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [byPriority, setByPriority] = useState<MetricsByPriorityItem[]>([]);
  const [byAgent, setByAgent] = useState<MetricsByAgentItem[]>([]);
  const [timeseries, setTimeseries] = useState<TimeseriesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateWindowDates = (range: PresetRange) => {
    const end = new Date();
    const start = new Date();
    if (range === "24h") {
      start.setHours(start.getHours() - 24);
    } else if (range === "7d") {
      start.setDate(start.getDate() - 7);
    } else if (range === "30d") {
      start.setDate(start.getDate() - 30);
    } else if (range === "90d") {
      start.setDate(start.getDate() - 90);
    }
    return {
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    };
  };

  const fetchMetrics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { start_time, end_time } = calculateWindowDates(preset);
      const [sumRes, prioRes, agentRes, tsRes] = await Promise.all([
        metricsApi.summary(start_time, end_time),
        metricsApi.byPriority(start_time, end_time),
        metricsApi.byAgent(start_time, end_time),
        metricsApi.timeseries(start_time, end_time),
      ]);

      setSummary(sumRes);
      setByPriority(prioRes);
      setByAgent(agentRes);
      setTimeseries(tsRes);
    } catch (err: any) {
      setError(err.message || "Failed to load SLA analytics");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [preset]);

  const formatMinutes = (minutes?: number | null): string => {
    if (minutes === undefined || minutes === null) return "—";
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = (minutes / 60).toFixed(1);
    return `${hours}h`;
  };

  // Format chart data
  const chartData =
    timeseries?.buckets.map((b) => ({
      time: formatDate(
        b.bucket_start,
        timeseries.granularity === "hourly" ? "HH:mm" : "MMM d"
      ),
      Created: b.created_count,
      Resolved: b.resolved_count,
      Missed: b.missed_count,
    })) || [];

  const complianceRate = summary?.compliance_rate;

  return (
    <AppShell
      title="SLA Intelligence & Historical Analytics"
      subtitle="Audited performance, resolution percentiles, and compliance rates"
      allowedRoles={[Role.ADMIN]}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              SLA Analytics & Reporting
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Deterministic metrics aggregated over tickets created within the selected window.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {(["24h", "7d", "30d", "90d"] as PresetRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setPreset(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  preset === r
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {r === "24h"
                  ? "Last 24 Hours"
                  : r === "7d"
                  ? "Last 7 Days"
                  : r === "30d"
                  ? "Last 30 Days"
                  : "Last 90 Days"}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-medium text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 text-slate-400">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-3" />
            <p className="text-xs font-medium">Aggregating SLA performance metrics...</p>
          </div>
        ) : (
          <>
            {/* Top KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Compliance Rate Card */}
              <Card className="border-l-4 border-l-indigo-600 shadow-sm">
                <CardHeader className="p-4 pb-1">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>SLA Compliance Rate</span>
                    <Gauge className="h-4 w-4 text-indigo-600" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-baseline gap-2">
                    <p
                      className={`text-3xl font-black ${
                        complianceRate === null || complianceRate === undefined
                          ? "text-slate-400"
                          : complianceRate >= 90
                          ? "text-emerald-600"
                          : complianceRate >= 75
                          ? "text-amber-600"
                          : "text-rose-600"
                      }`}
                    >
                      {complianceRate !== null && complianceRate !== undefined
                        ? `${complianceRate.toFixed(1)}%`
                        : "N/A"}
                    </p>
                    <span className="text-[11px] text-slate-500">
                      {summary?.met_count} met / {summary?.missed_count} missed
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Volume Card */}
              <Card className="border-l-4 border-l-blue-500 shadow-sm">
                <CardHeader className="p-4 pb-1">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>Tickets Ingested</span>
                    <Layers className="h-4 w-4 text-blue-500" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-slate-900 dark:text-slate-100">
                      {summary?.created_count}
                    </p>
                    <span className="text-[11px] text-slate-500">
                      {summary?.resolved_count} resolved ({summary?.closed_count} closed)
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Median Time to Resolution */}
              <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                <CardHeader className="p-4 pb-1">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>Median Resolution</span>
                    <Clock className="h-4 w-4 text-emerald-500" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-slate-900 dark:text-slate-100">
                      {formatMinutes(summary?.median_time_to_resolution_minutes)}
                    </p>
                    <span className="text-[11px] text-slate-500">50th percentile duration</span>
                  </div>
                </CardContent>
              </Card>

              {/* P90 Resolution Speed */}
              <Card className="border-l-4 border-l-purple-500 shadow-sm">
                <CardHeader className="p-4 pb-1">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>P90 Resolution</span>
                    <Zap className="h-4 w-4 text-purple-500" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-slate-900 dark:text-slate-100">
                      {formatMinutes(summary?.p90_time_to_resolution_minutes)}
                    </p>
                    <span className="text-[11px] text-slate-500">90% resolved within</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Timeseries Visual Chart */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      Ingestion & SLA Resolution Timeseries
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Granularity: {timeseries?.granularity} buckets over window
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 20, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                      <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderRadius: "8px",
                          border: "none",
                          color: "#f8fafc",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                      <Area
                        type="monotone"
                        dataKey="Created"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#createdGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="Resolved"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#resolvedGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Breakdown Tables: Priority & Agent */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Breakdown by Priority */}
              <Card>
                <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <CardTitle className="text-sm font-semibold">
                    Compliance by SLA Priority Level
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/60 font-semibold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Priority</th>
                          <th className="py-3 px-4">Created</th>
                          <th className="py-3 px-4">Resolved</th>
                          <th className="py-3 px-4">Met / Missed</th>
                          <th className="py-3 px-4">Compliance</th>
                          <th className="py-3 px-4">Median</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {byPriority.map((p) => {
                          const rate = p.compliance_rate;
                          return (
                            <tr key={p.priority} className="hover:bg-slate-50/50">
                              <td className="py-3 px-4 font-semibold uppercase tracking-wider">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                    p.priority === Priority.CRITICAL
                                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                      : p.priority === Priority.HIGH
                                      ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
                                      : p.priority === Priority.MEDIUM
                                      ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                                      : "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                                  }`}
                                >
                                  {p.priority}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-bold">{p.created_count}</td>
                              <td className="py-3 px-4">{p.resolved_count}</td>
                              <td className="py-3 px-4">
                                <span className="text-emerald-600 font-medium">
                                  {p.met_count}
                                </span>{" "}
                                /{" "}
                                <span className="text-rose-600 font-medium">
                                  {p.missed_count}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-bold">
                                {rate !== null && rate !== undefined ? (
                                  <span
                                    className={
                                      rate >= 90
                                        ? "text-emerald-600"
                                        : rate >= 75
                                        ? "text-amber-600"
                                        : "text-rose-600"
                                    }
                                  >
                                    {rate.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-slate-400">N/A</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-500">
                                {formatMinutes(p.median_time_to_resolution_minutes)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Breakdown by Agent */}
              <Card>
                <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <CardTitle className="text-sm font-semibold">
                    Agent Resolution & Speed Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {byAgent.length === 0 ? (
                    <p className="p-6 text-center text-xs text-slate-400">
                      No agent resolutions recorded in this window.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/60 font-semibold text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="py-3 px-4">Specialist</th>
                            <th className="py-3 px-4">Resolved</th>
                            <th className="py-3 px-4">Met / Missed</th>
                            <th className="py-3 px-4">Compliance</th>
                            <th className="py-3 px-4">Median Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                          {byAgent.map((a) => {
                            const rate = a.compliance_rate;
                            return (
                              <tr key={a.agent_id} className="hover:bg-slate-50/50">
                                <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                                  {a.agent_name}
                                </td>
                                <td className="py-3 px-4 font-bold">{a.resolved_count}</td>
                                <td className="py-3 px-4">
                                  <span className="text-emerald-600 font-medium">
                                    {a.met_count}
                                  </span>{" "}
                                  /{" "}
                                  <span className="text-rose-600 font-medium">
                                    {a.missed_count}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-bold">
                                  {rate !== null && rate !== undefined ? (
                                    <span
                                      className={
                                        rate >= 90
                                          ? "text-emerald-600"
                                          : rate >= 75
                                          ? "text-amber-600"
                                          : "text-rose-600"
                                      }
                                    >
                                      {rate.toFixed(1)}%
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">N/A</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-slate-500">
                                  {formatMinutes(a.median_time_to_resolution_minutes)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
