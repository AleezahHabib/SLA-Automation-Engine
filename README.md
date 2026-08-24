# Customer Support Ticket & SLA Automation Engine

A high-integrity Customer Support Ticket and SLA Automation Engine built with FastAPI, Next.js (App Router, TypeScript, Tailwind), SQLAlchemy async, PostgreSQL, and an autonomous asyncio SLA monitoring worker.

---

## Seed Demonstration Credentials

| Role | Email | Password | Description |
|---|---|---|---|
| **Admin** | `admin@example.com` | `Password123!` | Operational owner: dispatching, customer admin, reporting, priority overrides, closure |
| **Agent** | `agent.sarah@example.com` | `Password123!` | Support staff: assigned queues, state transitions (`open` $\rightarrow$ `in_progress` $\rightarrow$ `resolved`) |
| **Agent** | `agent.john@example.com` | `Password123!` | Support staff |
| **Agent** | `agent.jane@example.com` | `Password123!` | Support staff |
| **Customer A** | `customer.alice@acme.com` | `Password123!` | External client (Acme Corp): isolated portal view, live countdowns |
| **Customer B** | `customer.bob@globex.com` | `Password123!` | External client (Globex Inc): isolated tenant |

---

## Architectural Guarantees & Invariants

* **Deterministic Triage**: Rule-based priority scoring (`critical` 2h, `high` 8h, `medium` 24h, `low` 72h).
* **Strict Linear State Machine**: `open` $\rightarrow$ `in_progress` $\rightarrow$ `resolved` $\rightarrow$ `closed` (closed is terminal; no reopening).
* **Tenant Isolation**: Complete SQL-level data isolation for customer accounts.
* **Autonomous SLA Worker**: `asyncio` monitor scanning overdue tickets via `SELECT ... FOR UPDATE SKIP LOCKED` without blocking user requests.
* **Transactional Integrity**: All transitions, overrides, and assignments write audit records within the same atomic database transaction.
* **No Docker**: Native source execution for Railway backend and Vercel frontend.
