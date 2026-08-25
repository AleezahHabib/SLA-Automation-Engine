# 00 — Frontend Specification Overview

**Status:** Locked
**Applies to:** `frontend/` only
**Authority:** This file is the registry. Every other file in `frontend/specs/` is subordinate to it.

---

## 1. Purpose

This file exists to make the frontend specification set **non-overlapping and non-hallucinable**.

It does three jobs:

1. **Freezes shared vocabulary** so no two specs use different names for the same thing.
2. **Assigns exactly one owner** to every frontend capability, so no two specs describe the same behaviour.
3. **Defines what a spec may not invent**, so no spec asserts a backend fact that does not exist.

No other file in `frontend/specs/` may redefine anything in Sections 3, 4, or 5. They reference it.

---

## 2. Source-of-Truth Hierarchy

When two documents disagree, the higher row wins.

| Rank | Source | Governs |
|---|---|---|
| 1 | `backend/specs/03-API-CONTRACT.md` | Endpoint paths, request/response payloads, error shapes |
| 2 | `backend/specs/01-DOMAIN-MODEL.md` | Entity names, field names, enum values |
| 3 | `backend/specs/04-RBAC.md` | Roles and permissions |
| 4 | `backend/specs/05-STATE-MACHINE.md` | Which status transitions are legal |
| 5 | `backend/specs/06-SLA.md` | Priority scoring, deadline durations, breach definition |
| 6 | `frontend/specs/00-OVERVIEW.md` | Frontend routes, capability ownership, frontend vocabulary |
| 7 | All other `frontend/specs/*.md` | Presentation and interaction detail only |

**The frontend never defines business rules.** It renders the result of rules enforced by the backend.

---

## 3. Frozen Vocabulary

These values are **mirrors** of `backend/specs/01-DOMAIN-MODEL.md`. They are reproduced here only so frontend specs can be written before backend implementation exists. If the backend contract changes, this section is updated first, then every dependent spec.

They must be declared once in `frontend/types/enums.ts` and imported everywhere. No spec may introduce a variant spelling.

### 3.1 Roles

| Value | Label in UI |
|---|---|
| `admin` | Admin |
| `agent` | Agent |
| `customer` | Customer |

`admin` and `agent` are **staff** roles. `customer` is an **external** role with access to a separate portal.

A `customer` user is always linked to exactly one Customer record and can see only that record's tickets. The Customer entity still exists as a record in its own right — an admin may create one with no login attached — but a login can now be layered onto it.

"Dispatcher" is not a role — it is an activity performed by `admin`.

### 3.2 Ticket Status

| Value | Label in UI |
|---|---|
| `open` | Open |
| `in_progress` | In Progress |
| `resolved` | Resolved |
| `closed` | Closed |

### 3.3 Priority

| Value | Label in UI | SLA window |
|---|---|---|
| `critical` | Critical | 2 hours |
| `high` | High | 8 hours |
| `medium` | Medium | 24 hours |
| `low` | Low | 72 hours |

The SLA window column is displayed by the UI. It is **calculated and enforced by the backend**. The frontend never computes a deadline from a duration; it renders the `sla_deadline` timestamp the backend returns.

### 3.4 SLA Presentation States

These three values are **frontend-only presentation states**. They do not exist in the backend contract and must never be sent to the API.

| Value | Meaning |
|---|---|
| `on_track` | Now is before the at-risk threshold |
| `at_risk` | Now is past the at-risk threshold but before `sla_deadline` |
| `breached` | Now is past `sla_deadline`, or the backend reports a breach |

The at-risk threshold and the derivation rules are owned solely by `07-SLA-COUNTDOWN.md`.
Authoritative breach status always comes from the backend. The client-side computation is a display convenience and is never used to make a decision.

### 3.5 Naming Conventions

| Context | Convention | Example |
|---|---|---|
| API payload fields | `snake_case` | `assigned_agent_id` |
| TypeScript variables and props | `camelCase` | `assignedAgentId` |
| React components | `PascalCase` | `SlaCountdown` |
| Files and folders | `kebab-case` | `sla-countdown.tsx` |
| Route segments | `kebab-case` | `/admin/customers` |

Conversion between `snake_case` and `camelCase` happens in exactly one place, owned by `11-API-INTEGRATION.md`.

---

## 4. Route Ownership Map

Every route has exactly one owning spec. A spec may not describe a route it does not own.

| Route | Role guard | Owning spec |
|---|---|---|
| `/` | public | `01-AUTH-FLOW.md` |
| `/login` | public | `01-AUTH-FLOW.md` |
| `/register` | public | `01-AUTH-FLOW.md` |
| `/agent/dashboard` | `agent` | `02-AGENT-DASHBOARD.md` |
| `/agent/tickets` | `agent` | `05-TICKET-LIST.md` |
| `/agent/tickets/new` | `agent` | `06-TICKET-DETAIL.md` |
| `/agent/tickets/[ticketId]` | `agent` | `06-TICKET-DETAIL.md` |
| `/admin/dashboard` | `admin` | `03-ADMIN-DASHBOARD.md` |
| `/admin/tickets` | `admin` | `05-TICKET-LIST.md` |
| `/admin/tickets/[ticketId]` | `admin` | `06-TICKET-DETAIL.md` |
| `/admin/customers` | `admin` | `04-CUSTOMERS.md` |
| `/admin/customers/[customerId]` | `admin` | `04-CUSTOMERS.md` |
| `/admin/metrics` | `admin` | `10-METRICS.md` |
| `/register/customer` | public | `01-AUTH-FLOW.md` |
| `/portal/dashboard` | `customer` | `14-PORTAL.md` |
| `/portal/tickets` | `customer` | `05-TICKET-LIST.md` |
| `/portal/tickets/new` | `customer` | `06-TICKET-DETAIL.md` |
| `/portal/tickets/[ticketId]` | `customer` | `06-TICKET-DETAIL.md` |

`/` renders the public Landing Page showcasing autonomous SLA monitoring, interactive playground, state machine guarantees, and demonstration accounts launchpad. It provides session-aware navigation into `/login`, `/portal`, and `/tickets`.

Route guards are **cosmetic**. They prevent a confusing UI, not unauthorised access. Authorisation is enforced by the backend on every request.

---

## 5. Capability Ownership Matrix

Every frontend capability appears exactly once in the **Owner** column. A spec listing a capability under `## Owns` must match this table. A spec may reference another spec's capability only under `## Consumes`.

| ID | Capability | Owner | Consumed by |
|---|---|---|---|
| CAP-AUTH-LOGIN | Login form and submission | 01 | — |
| CAP-AUTH-REGISTER | Registration form and submission | 01 | — |
| CAP-AUTH-SESSION | Token persistence, session context, rehydration | 01 | 11 |
| CAP-AUTH-GUARD | Route protection and role-based redirect | 01 | 02, 03, 04, 05, 06, 10 |
| CAP-AUTH-LOGOUT | Sign-out and session teardown | 01 | 12 |
| CAP-AGENT-SUMMARY | Agent-scoped snapshot tiles | 02 | — |
| CAP-AGENT-QUEUE | "My assigned tickets" panel | 02 | — |
| CAP-AGENT-ATTENTION | Agent's at-risk and breached panel | 02 | — |
| CAP-ADMIN-SUMMARY | Organisation-wide snapshot tiles | 03 | — |
| CAP-ADMIN-UNASSIGNED | Unassigned ticket queue panel | 03 | — |
| CAP-ADMIN-AGENT-LOAD | Per-agent workload panel | 03 | — |
| CAP-CUST-LIST | Customer list view | 04 | — |
| CAP-CUST-DETAIL | Customer detail view and linked tickets | 04 | — |
| CAP-CUST-CREATE | Create-customer form | 04 | — |
| CAP-CUST-EDIT | Edit-customer form | 04 | — |
| CAP-TLIST-TABLE | Ticket table structure, columns, row rendering | 05 | 02, 03 |
| CAP-TLIST-FILTER | Status, priority, assignee, customer filters | 05 | — |
| CAP-TLIST-SORT | Column sorting | 05 | — |
| CAP-TLIST-PAGINATE | Pagination controls | 05 | — |
| CAP-TLIST-SEARCH | Free-text ticket search | 05 | — |
| CAP-TDET-CREATE | Ticket intake form | 06 | — |
| CAP-TDET-VIEW | Ticket header and body presentation | 06 | — |
| CAP-TDET-TRANSITION | Status transition controls | 06 | — |
| CAP-TDET-ASSIGN | Assignment and reassignment control | 06 | — |
| CAP-SLA-TIMER | Live countdown component and tick logic | 07 | 06 |
| CAP-SLA-VISUAL | On-track / at-risk / breached presentation rules | 07 | 02, 03, 05, 06 |
| CAP-SLA-BADGE | Compact SLA badge for dense views | 07 | 02, 03, 05 |
| CAP-CMT-THREAD | Internal comment thread rendering | 08 | 06 |
| CAP-CMT-COMPOSE | Comment composer and submission | 08 | 06 |
| CAP-ATT-UPLOAD | File selection, upload, progress | 09 | 06 |
| CAP-ATT-LIST | Attachment list rendering | 09 | 06 |
| CAP-ATT-DOWNLOAD | Attachment retrieval and download | 09 | 06 |
| CAP-MET-FILTERS | Reporting date range and scope selection | 10 | — |
| CAP-MET-KPI | Historical aggregate metric tiles | 10 | — |
| CAP-MET-CHARTS | Reporting charts | 10 | — |
| CAP-MET-TABLE | Reporting breakdown table | 10 | — |
| CAP-API-CLIENT | HTTP client, base URL, request lifecycle | 11 | all |
| CAP-API-AUTH-HEADER | Attaching credentials to requests | 11 | all |
| CAP-API-ERRORS | Error normalisation and 401/403 handling | 11 | all |
| CAP-API-TYPES | OpenAPI-generated TypeScript types | 11 | all |
| CAP-API-QUERY | Data fetching, caching, revalidation conventions | 11 | all |
| CAP-DS-TOKENS | Colour, spacing, typography tokens | 12 | all |
| CAP-DS-STATUS-COLOR | Status and priority colour mapping | 12 | 02, 03, 05, 06, 07 |
| CAP-DS-PRIMITIVES | Shared UI primitives | 12 | all |
| CAP-DS-LAYOUT | App shell, sidebar, top bar, role navigation | 12 | 02, 03, 04, 05, 06, 10 |
| CAP-DS-FEEDBACK | Toast, empty state, skeleton, error boundary | 12 | all |
| CAP-TEST-UNIT | Unit test strategy and conventions | 13 | — |
| CAP-TEST-INTEGRATION | Integration test strategy and conventions | 13 | — |
| CAP-TEST-FIXTURES | Shared test fixtures and mock data | 13 | — |
| CAP-CMT-VISIBILITY | Internal vs customer-visible comment handling | 08 | 06, 14 |
| CAP-ATT-VISIBILITY | Attachment visibility to customers | 09 | 06, 14 |
| CAP-PORT-COMPOSE | Portal route group, shell, and read-only posture | 14 | — |
| CAP-PORT-SUMMARY | Customer-scoped snapshot tiles | 14 | — |
| CAP-PORT-QUEUE | The customer's own open-ticket panel | 14 | — |

### 5.1 Boundaries That Are Easy To Get Wrong

These pairs look like duplicates and are not. Each spec must respect the stated line.

| Looks like a clash | The actual boundary |
|---|---|
| 02/03 tiles vs. 10 tiles | 02 and 03 show a **live operational snapshot of current state** for the signed-in role. 10 shows **historical aggregates over a selected date range**. Different data, different endpoints. |
| 02/03 panels vs. 05 list | 05 owns the ticket table component and all of its behaviour. 02 and 03 own only **which panels appear on their page and with what preset query**. They never describe columns, filters, or sorting. |
| 03 unassigned queue vs. 06 assignment | 03 owns the **panel that lists** unassigned tickets. 06 owns the **control that performs** assignment. Clicking a row in 03 navigates to 06. |
| 05 badge vs. 07 badge | 07 owns the SLA badge component and all of its states. 05 owns only the **column it sits in**. |
| 06 detail vs. 08/09 | 06 owns the ticket page layout and declares where the comment and attachment regions mount. 08 and 09 own everything inside their regions. |
| 12 primitives vs. everyone | 12 owns generic, domain-agnostic components. The moment a component knows what a ticket is, it belongs to a feature spec. |
| 14 portal vs. 02/03 dashboards | 02 and 03 are staff dashboards. 14 is the customer portal. All three compose panels, from different scopes and with different panels. None owns a table or a tile component. |
| 14 portal vs. 05/06 | The portal reuses spec 05's table and spec 06's ticket page in their customer variants. 14 owns only the route group, the shell, and which panels the portal dashboard shows. |
| 08 visibility vs. 06 detail | 08 owns whether a comment is internal and how that is shown. 06 owns only where the comment region sits. |

---

## 6. Folder Conventions

| Path | Contains |
|---|---|
| `frontend/app/` | Route segments, layouts, page composition only. No business logic. |
| `frontend/components/ui/` | Domain-agnostic primitives. Owned by 12. |
| `frontend/components/layout/` | App shell, navigation. Owned by 12. |
| `frontend/components/feedback/` | Toast, empty state, skeleton, error boundary. Owned by 12. |
| `frontend/features/<slice>/` | Domain-aware components, hooks, and API calls for one slice. |
| `frontend/hooks/` | Generic hooks used by two or more slices. |
| `frontend/lib/` | API client, auth helpers, formatting, constants. |
| `frontend/types/` | Generated API types and frozen enums. |
| `frontend/tests/` | Test suites. Owned by 13. |

Feature slices are `auth`, `customers`, `tickets`, `sla`, `comments`, `attachments`, `metrics`, `portal`. No other slice may be created without updating this file.

---

## 7. Rules Every Spec Must Follow

**R1 — No invented backend facts.**
A spec must not state an endpoint path, field name, or response shape as fact unless it appears in `backend/specs/03-API-CONTRACT.md`. Until that file exists, required backend behaviour goes in a `## Backend Requirements` section, phrased as a requirement, never as an existing fact.

**R2 — No restating the contract.**
A spec references entity and field definitions. It never copies them. Copying is how two documents drift apart.

**R3 — One owner per capability.**
A spec describes only what Section 5 assigns to it. Anything else is referenced by capability ID under `## Consumes`.

**R4 — No business rules in the frontend.**
The frontend may not decide who is permitted to do something, whether a transition is legal, or whether an SLA is breached. It renders what the backend returns and disables what the backend would reject.

**R5 — Uncertainty is recorded, not resolved.**
If a spec needs a decision it cannot make, it goes in `## Open Questions` with a proposed default. A spec never invents an answer and never leaves the gap silent.

**R6 — Frozen vocabulary only.**
Every status, priority, and role string comes from Section 3. No synonyms, no alternative casing, no new values.

**R7 — Testable acceptance criteria.**
Every spec ends with numbered criteria that are objectively checkable. "Looks good" is not a criterion.

---

## 8. Required Spec Template

Every file from `01` to `13` uses exactly these sections, in this order.

```
# NN — Title

**Status:** Draft | Locked
**Owns:** CAP-... (comma separated, must match 00 Section 5)
**Routes:** (routes owned, or "None")

## Owns
## Does Not Own
## Consumes
## Backend Requirements
## Behaviour
## States and Edge Cases
## Acceptance Criteria
## Open Questions
```

`## Does Not Own` is mandatory and is the primary defence against overlap. It names the neighbouring capability and the spec that owns it.

---

## 9. Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Does ticket intake happen through staff only, the customer portal, or an email channel? | Staff UI and the customer portal; no email channel | `backend/specs/09-TICKETS.md` |
| Q2 | Can an agent create a customer record, or is that admin-only? | Admin-only | `backend/specs/04-RBAC.md` |
| Q3 | Are resolved tickets closed manually or automatically after a period? | Manually, by admin | `backend/specs/05-STATE-MACHINE.md` |
| Q4 | Is priority editable after automated triage, and by whom? | Admin may override, agent may not | `backend/specs/06-SLA.md` |
