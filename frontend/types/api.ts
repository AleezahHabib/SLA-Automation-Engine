import { AuditAction, Priority, Role, TicketStatus } from "./enums";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role | string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  customer_id?: string | null;
  customer_name?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  company?: string | null;
  phone?: string | null;
  is_archived: boolean;
  has_portal_access: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerSummary {
  id: string;
  name: string;
  email: string;
}

export interface AgentSummary {
  id: string;
  full_name: string;
  email: string;
}

export interface Ticket {
  id: string;
  reference: string;
  subject: string;
  description: string;
  status: TicketStatus | string;
  priority: Priority | string;
  customer: CustomerSummary;
  assigned_agent?: AgentSummary | null;
  created_at: string;
  updated_at: string;
  first_response_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  sla_deadline: string;
  sla_breached: boolean;
  sla_breached_at?: string | null;
  available_transitions: string[];
  can_assign: boolean;
  can_override_priority: boolean;
}

export interface TicketListItem {
  id: string;
  reference: string;
  subject: string;
  status: TicketStatus | string;
  priority: Priority | string;
  customer: CustomerSummary;
  assigned_agent?: AgentSummary | null;
  created_at: string;
  updated_at: string;
  sla_deadline: string;
  sla_breached: boolean;
}

export interface TicketSummaryCounts {
  by_status: Record<string, number>;
  by_priority?: Record<string, number> | null;
  unassigned?: number | null;
  breached?: number | null;
}

export interface Comment {
  id: string;
  ticket_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface Attachment {
  id: string;
  ticket_id: string;
  uploaded_by_id: string;
  uploaded_by_name: string;
  original_filename: string;
  storage_key: string;
  content_type: string;
  size_bytes: number;
  is_customer_visible: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  ticket_id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  action: AuditAction | string;
  from_value?: string | null;
  to_value?: string | null;
  detail?: string | null;
  created_at: string;
}

export interface AgentWorkload {
  agent_id: string;
  agent_name: string;
  assigned_total: number;
  by_status: Record<string, number>;
  breached_count: number;
}

export interface MetricsSummary {
  window_start: string;
  window_end: string;
  created_count: number;
  resolved_count: number;
  closed_count: number;
  met_count: number;
  missed_count: number;
  compliance_rate?: number | null;
  median_time_to_resolution_minutes?: number | null;
  p90_time_to_resolution_minutes?: number | null;
}

export interface MetricsByPriorityItem {
  priority: string;
  created_count: number;
  resolved_count: number;
  met_count: number;
  missed_count: number;
  compliance_rate?: number | null;
  median_time_to_resolution_minutes?: number | null;
}

export interface MetricsByAgentItem {
  agent_id: string;
  agent_name: string;
  resolved_count: number;
  met_count: number;
  missed_count: number;
  compliance_rate?: number | null;
  median_time_to_resolution_minutes?: number | null;
}

export interface TimeseriesBucket {
  bucket_start: string;
  created_count: number;
  resolved_count: number;
  missed_count: number;
}

export interface TimeseriesResponse {
  window_start: string;
  window_end: string;
  granularity: string;
  buckets: TimeseriesBucket[];
}

export interface PaginationEnvelope<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ErrorDetail {
  field?: string | null;
  message: string;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[] | null;
    request_id?: string | null;
  };
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}
