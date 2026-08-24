import {
  AgentSummary,
  AgentWorkload,
  Attachment,
  AuditLog,
  Comment,
  Customer,
  CustomerSummary,
  ErrorEnvelope,
  MetricsByAgentItem,
  MetricsByPriorityItem,
  MetricsSummary,
  PaginationEnvelope,
  Ticket,
  TicketListItem,
  TicketSummaryCounts,
  TimeseriesResponse,
  TokenResponse,
  User,
} from "@/types/api";
import { Priority, TicketStatus } from "@/types/enums";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiClientError extends Error {
  code: string;
  details?: Array<{ field?: string | null; message: string }> | null;
  status: number;
  requestId?: string | null;

  constructor(
    message: string,
    code: string = "error",
    status: number = 500,
    details?: Array<{ field?: string | null; message: string }> | null,
    requestId?: string | null
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("sla_access_token")
      : null;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = `${API_BASE_URL}${endpoint}`;
  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new ApiClientError(
      "Unable to connect to the backend server. Please ensure the API is running.",
      "network_error",
      0
    );
  }

  if (!response.ok) {
    let errEnvelope: ErrorEnvelope | null = null;
    try {
      errEnvelope = await response.json();
    } catch {
      // Non-JSON error payload
    }

    const code = errEnvelope?.error?.code || `http_${response.status}`;
    const msg =
      errEnvelope?.error?.message ||
      `Request failed with status ${response.status} (${response.statusText})`;
    const details = errEnvelope?.error?.details;
    const reqId =
      errEnvelope?.error?.request_id ||
      response.headers.get("X-Request-ID");

    throw new ApiClientError(msg, code, response.status, details, reqId);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ----------------------------------------------------------------------
// Auth API
// ----------------------------------------------------------------------
export const authApi = {
  async registerStaff(data: {
    email: string;
    password: string;
    full_name: string;
  }): Promise<TokenResponse> {
    return request<TokenResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async registerCustomer(data: {
    email: string;
    password: string;
    full_name: string;
    company?: string;
  }): Promise<TokenResponse> {
    return request<TokenResponse>("/api/v1/auth/register/customer", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async login(data: {
    email: string;
    password: string;
  }): Promise<TokenResponse> {
    return request<TokenResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getMe(): Promise<User> {
    return request<User>("/api/v1/auth/me", {
      method: "GET",
    });
  },
};

// ----------------------------------------------------------------------
// Customers API
// ----------------------------------------------------------------------
export const customersApi = {
  async list(params?: {
    page?: number;
    page_size?: number;
    search?: string;
    include_archived?: boolean;
  }): Promise<PaginationEnvelope<Customer>> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", params.page.toString());
    if (params?.page_size) query.set("page_size", params.page_size.toString());
    if (params?.search) query.set("search", params.search);
    if (params?.include_archived !== undefined)
      query.set("include_archived", String(params.include_archived));

    const qs = query.toString() ? `?${query.toString()}` : "";
    return request<PaginationEnvelope<Customer>>(`/api/v1/customers${qs}`);
  },

  async create(data: {
    name: string;
    email: string;
    company?: string;
    phone?: string;
  }): Promise<Customer> {
    return request<Customer>("/api/v1/customers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async get(id: string): Promise<Customer> {
    return request<Customer>(`/api/v1/customers/${id}`);
  },

  async update(
    id: string,
    data: {
      name?: string;
      email?: string;
      company?: string;
      phone?: string;
      is_archived?: boolean;
    }
  ): Promise<Customer> {
    return request<Customer>(`/api/v1/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async selectable(search?: string): Promise<CustomerSummary[]> {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    return request<CustomerSummary[]>(`/api/v1/customers/selectable${qs}`);
  },
};

// ----------------------------------------------------------------------
// Tickets API
// ----------------------------------------------------------------------
export const ticketsApi = {
  async summary(): Promise<TicketSummaryCounts> {
    return request<TicketSummaryCounts>("/api/v1/tickets/summary");
  },

  async list(params?: {
    page?: number;
    page_size?: number;
    status?: string[];
    priority?: string[];
    assigned_agent_id?: string;
    assigned_to_me?: boolean;
    unassigned?: boolean;
    customer_id?: string;
    breached?: boolean;
    search?: string;
    sort_by?: string;
    sort_order?: "asc" | "desc";
  }): Promise<PaginationEnvelope<TicketListItem>> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", params.page.toString());
    if (params?.page_size) query.set("page_size", params.page_size.toString());
    if (params?.status) {
      params.status.forEach((s) => query.append("status", s));
    }
    if (params?.priority) {
      params.priority.forEach((p) => query.append("priority", p));
    }
    if (params?.assigned_agent_id)
      query.set("assigned_agent_id", params.assigned_agent_id);
    if (params?.assigned_to_me !== undefined)
      query.set("assigned_to_me", String(params.assigned_to_me));
    if (params?.unassigned !== undefined)
      query.set("unassigned", String(params.unassigned));
    if (params?.customer_id) query.set("customer_id", params.customer_id);
    if (params?.breached !== undefined)
      query.set("breached", String(params.breached));
    if (params?.search) query.set("search", params.search);
    if (params?.sort_by) query.set("sort_by", params.sort_by);
    if (params?.sort_order) query.set("sort_order", params.sort_order);

    const qs = query.toString() ? `?${query.toString()}` : "";
    return request<PaginationEnvelope<TicketListItem>>(`/api/v1/tickets${qs}`);
  },

  async create(data: {
    subject: string;
    description: string;
    customer_id?: string;
  }): Promise<Ticket> {
    return request<Ticket>("/api/v1/tickets", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async get(id: string): Promise<Ticket> {
    return request<Ticket>(`/api/v1/tickets/${id}`);
  },

  async updateStatus(
    id: string,
    status: TicketStatus | string
  ): Promise<Ticket> {
    return request<Ticket>(`/api/v1/tickets/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  async updateAssignment(
    id: string,
    assigned_agent_id: string | null
  ): Promise<Ticket> {
    return request<Ticket>(`/api/v1/tickets/${id}/assignment`, {
      method: "PATCH",
      body: JSON.stringify({ assigned_agent_id }),
    });
  },

  async updatePriority(
    id: string,
    priority: Priority | string
  ): Promise<Ticket> {
    return request<Ticket>(`/api/v1/tickets/${id}/priority`, {
      method: "PATCH",
      body: JSON.stringify({ priority }),
    });
  },
};

// ----------------------------------------------------------------------
// Comments API
// ----------------------------------------------------------------------
export const commentsApi = {
  async list(
    ticketId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<PaginationEnvelope<Comment>> {
    return request<PaginationEnvelope<Comment>>(
      `/api/v1/tickets/${ticketId}/comments?page=${page}&page_size=${pageSize}`
    );
  },

  async create(
    ticketId: string,
    data: { body: string; is_internal?: boolean }
  ): Promise<Comment> {
    return request<Comment>(`/api/v1/tickets/${ticketId}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

// ----------------------------------------------------------------------
// Attachments API
// ----------------------------------------------------------------------
export const attachmentsApi = {
  async list(ticketId: string): Promise<Attachment[]> {
    return request<Attachment[]>(`/api/v1/tickets/${ticketId}/attachments`);
  },

  async upload(
    ticketId: string,
    file: File,
    isCustomerVisible: boolean = false
  ): Promise<Attachment> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("is_customer_visible", String(isCustomerVisible));

    return request<Attachment>(`/api/v1/tickets/${ticketId}/attachments`, {
      method: "POST",
      body: formData,
    });
  },

  getDownloadUrl(attachmentId: string): string {
    return `${API_BASE_URL}/api/v1/attachments/${attachmentId}/content`;
  },
};

// ----------------------------------------------------------------------
// Audit API
// ----------------------------------------------------------------------
export const auditApi = {
  async list(
    ticketId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<PaginationEnvelope<AuditLog>> {
    return request<PaginationEnvelope<AuditLog>>(
      `/api/v1/tickets/${ticketId}/audit?page=${page}&page_size=${pageSize}`
    );
  },
};

// ----------------------------------------------------------------------
// Agents API
// ----------------------------------------------------------------------
export const agentsApi = {
  async list(): Promise<AgentSummary[]> {
    return request<AgentSummary[]>("/api/v1/agents");
  },

  async workload(): Promise<AgentWorkload[]> {
    return request<AgentWorkload[]>("/api/v1/agents/workload");
  },
};

// ----------------------------------------------------------------------
// Metrics API
// ----------------------------------------------------------------------
export const metricsApi = {
  async summary(
    startTime: string,
    endTime: string
  ): Promise<MetricsSummary> {
    const qs = `?start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`;
    return request<MetricsSummary>(`/api/v1/metrics/summary${qs}`);
  },

  async byPriority(
    startTime: string,
    endTime: string
  ): Promise<MetricsByPriorityItem[]> {
    const qs = `?start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`;
    return request<MetricsByPriorityItem[]>(`/api/v1/metrics/by-priority${qs}`);
  },

  async byAgent(
    startTime: string,
    endTime: string
  ): Promise<MetricsByAgentItem[]> {
    const qs = `?start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`;
    return request<MetricsByAgentItem[]>(`/api/v1/metrics/by-agent${qs}`);
  },

  async timeseries(
    startTime: string,
    endTime: string
  ): Promise<TimeseriesResponse> {
    const qs = `?start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`;
    return request<TimeseriesResponse>(`/api/v1/metrics/timeseries${qs}`);
  },
};

// ----------------------------------------------------------------------
// Health API
// ----------------------------------------------------------------------
export const healthApi = {
  async check(): Promise<{ status: string }> {
    return request<{ status: string }>("/health");
  },
};
