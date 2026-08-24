"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  agentsApi,
  attachmentsApi,
  auditApi,
  commentsApi,
  ticketsApi,
} from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { SlaCountdown } from "@/components/sla/SlaCountdown";
import { formatBytes, formatDate, formatRelativeTime } from "@/lib/utils";
import {
  AgentSummary,
  Attachment,
  AuditLog,
  Comment,
  Ticket,
} from "@/types/api";
import { AuditAction, Priority, Role, TicketStatus } from "@/types/enums";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  History,
  Info,
  Loader2,
  Lock,
  MessageSquare,
  Paperclip,
  Play,
  Send,
  Shield,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";

export default function StaffTicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [activeTab, setActiveTab] = useState<"discussion" | "attachments" | "audit">("discussion");
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  // Modals state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [isPriorityModalOpen, setIsPriorityModalOpen] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<string>("");

  // Comment state
  const [commentBody, setCommentBody] = useState("");
  const [isInternalComment, setIsInternalComment] = useState(true);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Attachment upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCustomerVisibleFile, setIsCustomerVisibleFile] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const isAdmin = user?.role === Role.ADMIN;
  const isAgent = user?.role === Role.AGENT;

  const fetchTicketFull = async () => {
    try {
      const promises: Promise<any>[] = [
        ticketsApi.get(ticketId),
        commentsApi.list(ticketId, 1, 100),
        attachmentsApi.list(ticketId),
      ];

      if (isAdmin) {
        promises.push(auditApi.list(ticketId, 1, 100));
        promises.push(agentsApi.list());
      }

      const [ticketRes, commentsRes, attachmentsRes, auditRes, agentsRes] =
        await Promise.all(promises);

      setTicket(ticketRes);
      setComments(commentsRes.items);
      setAttachments(attachmentsRes);
      if (auditRes) setAuditLogs(auditRes.items);
      if (agentsRes) setAgents(agentsRes);

      if (ticketRes.assigned_agent) {
        setSelectedAgentId(ticketRes.assigned_agent.id);
      } else {
        setSelectedAgentId("");
      }
      setSelectedPriority(ticketRes.priority);
    } catch (err: any) {
      setActionError(err.message || "Failed to load ticket");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) {
      fetchTicketFull();
    }
  }, [ticketId]);

  // Transition Handler
  const handleTransition = async (targetStatus: TicketStatus | string) => {
    setActionError(null);
    setIsMutating(true);
    try {
      const updated = await ticketsApi.updateStatus(ticketId, targetStatus);
      setTicket(updated);
      await fetchTicketFull();
    } catch (err: any) {
      setActionError(err.message || "Transition rejected");
    } finally {
      setIsMutating(false);
    }
  };

  // Assignment Handler
  const handleAssignmentSave = async () => {
    setActionError(null);
    setIsMutating(true);
    try {
      const agentId = selectedAgentId === "unassign" || !selectedAgentId ? null : selectedAgentId;
      const updated = await ticketsApi.updateAssignment(ticketId, agentId);
      setTicket(updated);
      setIsAssignModalOpen(false);
      await fetchTicketFull();
    } catch (err: any) {
      setActionError(err.message || "Assignment failed");
    } finally {
      setIsMutating(false);
    }
  };

  // Priority Override Handler
  const handlePrioritySave = async () => {
    setActionError(null);
    setIsMutating(true);
    try {
      const updated = await ticketsApi.updatePriority(ticketId, selectedPriority);
      setTicket(updated);
      setIsPriorityModalOpen(false);
      await fetchTicketFull();
    } catch (err: any) {
      setActionError(err.message || "Priority override failed");
    } finally {
      setIsMutating(false);
    }
  };

  // Comment Submit
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bodyClean = commentBody.trim();
    if (!bodyClean) return;

    setIsSubmittingComment(true);
    setActionError(null);
    try {
      const newComment = await commentsApi.create(ticketId, {
        body: bodyClean,
        is_internal: isInternalComment,
      });
      setComments((prev) => [...prev, newComment]);
      setCommentBody("");
      if (isAdmin) fetchTicketFull();
    } catch (err: any) {
      setActionError(err.message || "Failed to post comment");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Attachment Submit
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploadingFile(true);
    setActionError(null);
    try {
      const newAtt = await attachmentsApi.upload(
        ticketId,
        selectedFile,
        isCustomerVisibleFile
      );
      setAttachments((prev) => [...prev, newAtt]);
      setSelectedFile(null);
      const fileInput = document.getElementById("staff-file-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      if (isAdmin) fetchTicketFull();
    } catch (err: any) {
      setActionError(err.message || "Failed to upload attachment");
    } finally {
      setIsUploadingFile(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell allowedRoles={[Role.ADMIN, Role.AGENT]}>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </AppShell>
    );
  }

  if (!ticket) {
    return (
      <AppShell allowedRoles={[Role.ADMIN, Role.AGENT]}>
        <div className="text-center py-16">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold">Ticket Not Found</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">{actionError}</p>
          <Link href="/tickets">
            <Button variant="outline">Back to Tickets</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const isClosed = ticket.status === TicketStatus.CLOSED;

  return (
    <AppShell
      title={`Ticket: ${ticket.reference}`}
      subtitle={`Customer: ${ticket.customer.name} | Status: ${ticket.status}`}
      allowedRoles={[Role.ADMIN, Role.AGENT]}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation and Top State Action Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <Link
            href="/tickets"
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Ticket Desk
          </Link>

          {/* Lifecycle State Mutation Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Dynamic Status Action Buttons from available_transitions */}
            {ticket.available_transitions.includes(TicketStatus.IN_PROGRESS) && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleTransition(TicketStatus.IN_PROGRESS)}
                isLoading={isMutating}
                className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 shadow-amber-600/20"
              >
                <Play className="mr-1.5 h-3.5 w-3.5" /> Start Work (In Progress)
              </Button>
            )}

            {ticket.available_transitions.includes(TicketStatus.RESOLVED) && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleTransition(TicketStatus.RESOLVED)}
                isLoading={isMutating}
                className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 shadow-emerald-600/20"
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Resolve Ticket
              </Button>
            )}

            {ticket.available_transitions.includes(TicketStatus.CLOSED) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTransition(TicketStatus.CLOSED)}
                isLoading={isMutating}
                className="border-slate-400 text-slate-700 hover:bg-slate-100 dark:text-slate-200"
              >
                <XCircle className="mr-1.5 h-3.5 w-3.5 text-slate-500" /> Close & Archive
              </Button>
            )}

            {/* Admin Dispatch & Override Controls */}
            {ticket.can_assign && !isClosed && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAssignModalOpen(true)}
              >
                <UserCheck className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
                {ticket.assigned_agent ? "Reassign" : "Assign Agent"}
              </Button>
            )}

            {ticket.can_override_priority && !isClosed && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPriorityModalOpen(true)}
              >
                <Shield className="mr-1.5 h-3.5 w-3.5 text-orange-600" />
                Override Priority
              </Button>
            )}
          </div>
        </div>

        {/* Global Error Banner */}
        {actionError && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center justify-between">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="underline ml-4">
              Dismiss
            </button>
          </div>
        )}

        {/* Main Header & Metadata Overview */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {ticket.reference}
                </span>
                <Badge status={ticket.status} />
                <Badge priority={ticket.priority} />
                {ticket.sla_breached && (
                  <span className="inline-flex items-center gap-1 rounded bg-rose-100 dark:bg-rose-950 px-2 py-0.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                    <AlertCircle className="h-3 w-3" /> Breached
                  </span>
                )}
              </div>

              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {ticket.subject}
              </h1>

              {/* Stakeholders & Timestamps Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Customer</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {ticket.customer.name}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {ticket.customer.email}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Assigned Staff</p>
                  {ticket.assigned_agent ? (
                    <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {ticket.assigned_agent.full_name}
                    </p>
                  ) : (
                    <p className="text-orange-600 dark:text-orange-400 font-semibold mt-0.5">
                      Unassigned
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Created</p>
                  <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                    {formatDate(ticket.created_at)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Last Activity</p>
                  <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                    {formatRelativeTime(ticket.updated_at)}
                  </p>
                </div>
              </div>
            </div>

            {/* SLA Response Timer */}
            <div className="lg:w-80 shrink-0">
              <SlaCountdown
                createdAt={ticket.created_at}
                deadline={ticket.sla_deadline}
                status={ticket.status}
                priority={ticket.priority}
                isBreached={ticket.sla_breached}
                resolvedAt={ticket.resolved_at}
              />
            </div>
          </div>

          {/* Description */}
          <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Issue Intake Description
            </h3>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-4 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {ticket.description}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("discussion")}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "discussion"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <MessageSquare className="h-4 w-4" /> Discussion & Notes ({comments.length})
          </button>

          <button
            onClick={() => setActiveTab("attachments")}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "attachments"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <Paperclip className="h-4 w-4" /> Attachments ({attachments.length}/10)
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab("audit")}
              className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === "audit"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              }`}
            >
              <History className="h-4 w-4" /> Immutable Audit Trail ({auditLogs.length})
            </button>
          )}
        </div>

        {/* Tab 1: Discussion Thread */}
        {activeTab === "discussion" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardContent className="p-6 space-y-6">
                  {comments.length === 0 ? (
                    <p className="text-center py-8 text-slate-400 text-xs">
                      No comments or notes recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {comments.map((c) => (
                        <div
                          key={c.id}
                          className={`flex flex-col rounded-xl p-4 text-xs border ${
                            c.is_internal
                              ? "bg-amber-50/60 border-amber-300/80 dark:bg-amber-950/30 dark:border-amber-900/60"
                              : "bg-indigo-50/50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900/60"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {c.author_name}
                              </span>
                              {c.is_internal ? (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-200/70 dark:bg-amber-900/60 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-200">
                                  <Lock className="h-2.5 w-2.5" /> Internal Staff Note
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300">
                                  <Eye className="h-2.5 w-2.5" /> Public (Visible to Customer)
                                </span>
                              )}
                            </div>
                            <span className="text-slate-400 text-[11px]">
                              {formatRelativeTime(c.created_at)} ({formatDate(c.created_at)})
                            </span>
                          </div>
                          <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {c.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Comment Input */}
                  {isClosed ? (
                    <div className="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-3.5 text-xs text-slate-600 dark:text-slate-300">
                      <Lock className="h-4 w-4 text-slate-500" />
                      <span>This ticket is closed. Commenting is permanently disabled.</span>
                    </div>
                  ) : (
                    <form onSubmit={handleCommentSubmit} className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <Textarea
                        placeholder="Add internal handover notes or public customer response..."
                        rows={3}
                        maxChars={4000}
                        charCount={commentBody.length}
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                      />

                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isInternalComment}
                            onChange={(e) => setIsInternalComment(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>
                            {isInternalComment
                              ? "Internal Note (Staff only)"
                              : "Public Reply (Visible to Customer)"}
                          </span>
                        </label>

                        <Button
                          type="submit"
                          size="sm"
                          disabled={!commentBody.trim() || isSubmittingComment}
                          isLoading={isSubmittingComment}
                        >
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                          Add Note / Reply
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Tab 2: Attachments */}
        {activeTab === "attachments" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <CardTitle className="text-sm font-semibold">Attached Files</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {attachments.length === 0 ? (
                    <p className="text-center py-6 text-slate-400 text-xs">
                      No files uploaded to this ticket.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs"
                        >
                          <div className="flex items-center gap-3 truncate pr-4">
                            <FileText className="h-5 w-5 text-indigo-600 shrink-0" />
                            <div className="truncate">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                  {att.original_filename}
                                </p>
                                {att.is_customer_visible ? (
                                  <span className="rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
                                    Customer Visible
                                  </span>
                                ) : (
                                  <span className="rounded bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">
                                    Internal Only
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {formatBytes(att.size_bytes)} • Uploaded by {att.uploaded_by_name} ({formatDate(att.created_at)})
                              </p>
                            </div>
                          </div>
                          <a
                            href={attachmentsApi.getDownloadUrl(att.id)}
                            download={att.original_filename}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {!isClosed && attachments.length < 10 && (
                    <form onSubmit={handleFileUpload} className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Upload Diagnostic Attachment (max 5 MB)
                      </label>
                      <input
                        id="staff-file-upload"
                        type="file"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                      />
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isCustomerVisibleFile}
                            onChange={(e) => setIsCustomerVisibleFile(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600"
                          />
                          <span>Allow customer to view/download this file</span>
                        </label>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!selectedFile || isUploadingFile}
                          isLoading={isUploadingFile}
                        >
                          <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload File
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Tab 3: Immutable Audit Trail (Admin only) */}
        {activeTab === "audit" && isAdmin && (
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-indigo-600" />
                Immutable Chronological Event Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs"
                  >
                    <div className="h-2 w-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                          {log.action.replace(/_/g, " ")}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">
                        Actor: <span className="font-medium text-slate-900 dark:text-slate-200">{log.actor_name || "System (SLA Worker)"}</span>
                      </p>
                      {(log.from_value || log.to_value) && (
                        <p className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                          {log.from_value || "None"} &rarr; {log.to_value}
                        </p>
                      )}
                      {log.detail && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                          {log.detail}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modal: Assignment / Dispatcher */}
        <Modal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          title="Assign Ticket to Agent"
          description="Dispatch this ticket to an active specialist for work."
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Select Agent
              </label>
              <Select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
              >
                {ticket.status !== TicketStatus.IN_PROGRESS && (
                  <option value="unassign">-- Unassign (Return to Pool) --</option>
                )}
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name} ({a.email})
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAssignModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAssignmentSave}
                isLoading={isMutating}
              >
                Confirm Assignment
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal: Priority Override */}
        <Modal
          isOpen={isPriorityModalOpen}
          onClose={() => setIsPriorityModalOpen(false)}
          title="Administrative Priority Override"
          description="Recalculates the SLA deadline from the ticket's original creation timestamp."
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                New Priority Level
              </label>
              <Select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                options={[
                  { value: Priority.CRITICAL, label: "Critical (2-Hour Window)" },
                  { value: Priority.HIGH, label: "High (8-Hour Window)" },
                  { value: Priority.MEDIUM, label: "Medium (24-Hour Window)" },
                  { value: Priority.LOW, label: "Low (72-Hour Window)" },
                ]}
              />
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-semibold">Important SLA Invariant:</p>
              <p className="mt-0.5">
                The deadline will be recalculated using the ticket's original creation date ({formatDate(ticket.created_at)}), not the current time.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPriorityModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handlePrioritySave}
                isLoading={isMutating}
              >
                Apply Override
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}
