"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { attachmentsApi, commentsApi, ticketsApi } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { SlaCountdown } from "@/components/sla/SlaCountdown";
import { formatBytes, formatDate, formatRelativeTime } from "@/lib/utils";
import { Attachment, Comment, Ticket } from "@/types/api";
import { Role, TicketStatus } from "@/types/enums";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  Lock,
  MessageSquare,
  Paperclip,
  Send,
  Upload,
} from "lucide-react";

export default function CustomerTicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;
  const router = useRouter();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New comment state
  const [commentBody, setCommentBody] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  // Attachment upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchTicketDetails = async () => {
    try {
      const [ticketRes, commentsRes, attachmentsRes] = await Promise.all([
        ticketsApi.get(ticketId),
        commentsApi.list(ticketId, 1, 100),
        attachmentsApi.list(ticketId),
      ]);
      setTicket(ticketRes);
      setComments(commentsRes.items);
      setAttachments(attachmentsRes);
    } catch (err: any) {
      if (err.status === 404) {
        setError("This ticket was not found or you do not have permission to view it.");
      } else {
        setError(err.message || "Failed to load ticket details");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) {
      fetchTicketDetails();
    }
  }, [ticketId]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError(null);
    const bodyClean = commentBody.trim();
    if (!bodyClean) return;

    setIsSubmittingComment(true);
    try {
      const newComment = await commentsApi.create(ticketId, {
        body: bodyClean,
        is_internal: false, // Customer comments are always public
      });
      setComments((prev) => [...prev, newComment]);
      setCommentBody("");
    } catch (err: any) {
      setCommentError(err.message || "Failed to submit comment");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploadError(null);

    if (selectedFile.size > 5 * 1024 * 1024) {
      setUploadError("File exceeds maximum allowed size of 5 MB");
      return;
    }

    setIsUploadingFile(true);
    try {
      const newAttachment = await attachmentsApi.upload(
        ticketId,
        selectedFile,
        true // Customer files are always visible
      );
      setAttachments((prev) => [...prev, newAttachment]);
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload attachment");
    } finally {
      setIsUploadingFile(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell allowedRoles={[Role.CUSTOMER]}>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </AppShell>
    );
  }

  if (error || !ticket) {
    return (
      <AppShell allowedRoles={[Role.CUSTOMER]}>
        <div className="max-w-xl mx-auto text-center py-16">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Ticket Unavailable
          </h2>
          <p className="text-xs text-slate-500 mt-1 mb-6">{error}</p>
          <Link href="/portal">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Tickets
            </Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const isClosed = ticket.status === TicketStatus.CLOSED;

  return (
    <AppShell
      title={`Support Request: ${ticket.reference}`}
      subtitle={`Created on ${formatDate(ticket.created_at)}`}
      allowedRoles={[Role.CUSTOMER]}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Support Tickets
        </Link>

        {/* Main Header Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {ticket.reference}
                </span>
                <Badge status={ticket.status} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {ticket.subject}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Opened: {formatDate(ticket.created_at)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Updated: {formatRelativeTime(ticket.updated_at)}
                </span>
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

          {/* Ticket Description */}
          <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Initial Description
            </h3>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-4 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {ticket.description}
            </div>
          </div>
        </div>

        {/* Two-Column Layout: Comments & Files */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Comments Thread (Span 2) */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-indigo-600" />
                    Discussion & Support Updates ({comments.length})
                  </CardTitle>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {comments.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No replies yet. An agent will respond shortly within your SLA window.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments.map((c) => {
                      const isCustomerAuthor = c.author_role === Role.CUSTOMER;
                      return (
                        <div
                          key={c.id}
                          className={`flex flex-col rounded-xl p-4 text-xs border ${
                            isCustomerAuthor
                              ? "bg-slate-50 border-slate-200 dark:bg-slate-950/50 dark:border-slate-800 ml-4"
                              : "bg-indigo-50/40 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900/60 mr-4"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {isCustomerAuthor ? "You" : "Support Specialist"}
                              </span>
                              {!isCustomerAuthor && (
                                <span className="rounded bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300">
                                  Support Team
                                </span>
                              )}
                            </div>
                            <span className="text-slate-400 text-[11px]">
                              {formatRelativeTime(c.created_at)}
                            </span>
                          </div>
                          <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {c.body}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Comment Input or Closed Notice */}
                {isClosed ? (
                  <div className="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-3.5 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    <Lock className="h-4 w-4 shrink-0 text-slate-500" />
                    <span>
                      This ticket has been permanently closed. Further replies are disabled.
                    </span>
                  </div>
                ) : (
                  <form onSubmit={handleCommentSubmit} className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    {commentError && (
                      <p className="text-xs text-rose-600">{commentError}</p>
                    )}
                    <Textarea
                      placeholder="Type a reply or additional details..."
                      rows={3}
                      maxChars={4000}
                      charCount={commentBody.length}
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!commentBody.trim() || isSubmittingComment}
                        isLoading={isSubmittingComment}
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        Send Reply
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Attachments */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-indigo-600" />
                  Attachments ({attachments.length}/10)
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {attachments.length === 0 ? (
                  <p className="text-center py-4 text-slate-400 text-xs">
                    No files attached.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FileText className="h-4 w-4 text-slate-500 shrink-0" />
                          <div className="truncate">
                            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                              {att.original_filename}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {formatBytes(att.size_bytes)}
                            </p>
                          </div>
                        </div>
                        <a
                          href={attachmentsApi.getDownloadUrl(att.id)}
                          download={att.original_filename}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                          title="Download file"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Form */}
                {!isClosed && attachments.length < 10 && (
                  <form onSubmit={handleFileUpload} className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                    {uploadError && (
                      <p className="text-xs text-rose-600">{uploadError}</p>
                    )}
                    <label className="block text-[11px] font-medium text-slate-500">
                      Upload diagnostic log, screenshot, or PDF (max 5 MB)
                    </label>
                    <input
                      id="file-upload"
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-slate-800 dark:file:text-slate-200"
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      className="w-full mt-1"
                      disabled={!selectedFile || isUploadingFile}
                      isLoading={isUploadingFile}
                    >
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      Upload File
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
