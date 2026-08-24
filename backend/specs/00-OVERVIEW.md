# 00 — Backend Specification Overview

**Status:** Locked
**Applies to:** `backend/` only
**Authority:** This file is the backend registry. Files `01`–`17` are subordinate to it.

---

## 1. Purpose and the Authority Inversion

The frontend specification set was written first. It could not cite a contract that did not exist, so every frontend spec recorded what it *needed* as numbered Backend Requirements (`BR-n`) and labelled every endpoint "candidate — to be confirmed, not assumed."

**Those 90 requirements are the input to this set.** From the moment these files exist, the direction of authority reverses:

> `backend/specs/` is authoritative. Where a frontend spec disagrees with a file here, the frontend spec is wrong and is corrected.

This is the consumer-driven contract pattern: the consumer states its needs, the provider formalises them, and the formalised contract then outranks the consumer.

---

## 2. Source-of-Truth Hierarchy

| Rank | Source | Governs |
|---|---|---|
| 1 | `01-DOMAIN-MODEL.md` | Entities, field names, enum values |
| 2 | `03-API-CONTRACT.md` | Endpoint paths, payloads, error envelope |
| 3 | `04-RBAC.md` | Roles, claims, permission matrix |
| 4 | `05-STATE-MACHINE.md` | Legal transitions |
| 5 | `06-SLA.md` | Triage, deadlines, breach definition |
| 6 | `02-DATABASE.md` | Physical schema, indexes, constraints |
| 7 | `07`–`17` | Feature and operational behaviour |
| 8 | `frontend/specs/*.md` | Presentation only |

---

## 3. Frozen Vocabulary — Authoritative

`frontend/specs/00-OVERVIEW.md` Section 3 is a **mirror** of this section. When a value changes here, that mirror is updated in the same change, never later.

| Concept | Values |
|---|---|
| Role | `admin`, `agent`, `customer` |
| Ticket status | `open`, `in_progress`, `resolved`, `closed` |
| Priority | `critical`, `high`, `medium`, `low` |

`admin` and `agent` are **staff** roles. `customer` is an **external** role: a `customer` user is linked to exactly one Customer record and may see only that record's data.

A Customer record still exists independently of any login — an admin may create one to log a ticket raised by phone — but a login can now be layered onto it. There is no dispatcher role; dispatching is an activity performed by `admin`.

**Tenant isolation is the strongest guarantee in this system.** A scoping error that shows one customer another customer's ticket is a data breach, not a bug. Every query touched by a `customer` caller is scoped in SQL, and spec 17 tests it as an invariant.

`on_track`, `at_risk`, and `breached` are **frontend presentation states**. They are defined in `frontend/specs/07-SLA-COUNTDOWN.md`, appear in no payload, and no backend service may accept or emit them.

---

## 4. Layering Rules

Requests flow in one direction only.

```
route  ->  dependency (auth, role, session)  ->  service  ->  repository/ORM  ->  PostgreSQL
```

| Layer | May do | May never do |
|---|---|---|
| Route | Parse, validate via Pydantic, call one service, shape the response | Contain a business rule or touch the ORM |
| Dependency | Authenticate, resolve the current user, enforce a role | Perform domain work |
| Service | All business rules, own the transaction boundary | Know about HTTP status codes or requests |
| Model / repository | Persistence and relationships | Contain a rule |

A rule expressible in SQL or Python lives in a service, never in a route and never in the database as a trigger, because a rule split across two places drifts.

---

## 5. Backend Capability Registry

Each capability has exactly one owner. A spec's `**Owns:**` header must match this table.

| ID | Capability | Owner |
|---|---|---|
| BE-ENTITIES | Entity definitions and field lists | 01 |
| BE-ENUMS | Enumerated value definitions | 01 |
| BE-RELATIONS | Relationships and cardinality | 01 |
| BE-SCHEMA | Physical table definitions | 02 |
| BE-INDEXES | Index strategy | 02 |
| BE-CONSTRAINTS | Foreign keys, uniqueness, check constraints | 02 |
| BE-MIGRATIONS | Migration policy and reproducibility | 02 |
| BE-ENDPOINTS | Endpoint inventory, paths, methods | 03 |
| BE-ENVELOPE | Request and response envelope shapes | 03 |
| BE-PAGINATION | Pagination contract | 03 |
| BE-ERRORS | Error envelope and status-code semantics | 03 |
| BE-OPENAPI | OpenAPI schema generation and stability | 03 |
| BE-ROLES | Role definitions | 04 |
| BE-PERMISSIONS | The permission matrix | 04 |
| BE-JWT-CLAIMS | Token claim structure | 04 |
| BE-GUARDS | Authorisation dependencies | 04 |
| BE-TRANSITIONS | The legal transition table | 05 |
| BE-STATE-GUARDS | Preconditions on each transition | 05 |
| BE-EFFECTS | Side effects of a transition | 05 |
| BE-TRIAGE | Automated priority scoring | 06 |
| BE-DEADLINE | Deadline computation | 06 |
| BE-BREACH-DEF | The definition of a breach | 06 |
| BE-COMPLIANCE | The compliance calculation | 06 |
| BE-REGISTER | Registration | 07 |
| BE-LOGIN | Login | 07 |
| BE-TOKEN | Token issuance and validation | 07 |
| BE-CURRENT-USER | Current-user resolution | 07 |
| BE-HASHING | Password hashing policy | 07 |
| BE-CUST-CRUD | Customer create, read, update | 08 |
| BE-CUST-SEARCH | Customer search and listing | 08 |
| BE-CUST-BINDING | Binding a ticket to a customer | 08 |
| BE-TICKET-CREATE | Ticket creation | 09 |
| BE-TICKET-READ | Single-ticket retrieval | 09 |
| BE-TICKET-QUERY | Ticket listing, filtering, sorting | 09 |
| BE-REFERENCE | Human-readable ticket reference | 09 |
| BE-ASSIGN | Assignment and reassignment | 10 |
| BE-UNASSIGN | Clearing an assignment | 10 |
| BE-ASSIGNABLE | Listing assignable agents | 10 |
| BE-COMMENT-CREATE | Comment creation | 11 |
| BE-COMMENT-LIST | Comment listing | 11 |
| BE-IMMUTABILITY | Comment immutability guarantee | 11 |
| BE-UPLOAD | Attachment upload | 12 |
| BE-STORAGE | Durable storage strategy | 12 |
| BE-RETRIEVE | Authenticated retrieval | 12 |
| BE-FILE-VALIDATION | Size and type validation | 12 |
| BE-WORKER-LOOP | The asyncio monitor loop | 13 |
| BE-CLAIM | Concurrency-safe ticket claiming | 13 |
| BE-BREACH-EVENT | Breach detection and recording | 13 |
| BE-LIFESPAN | Worker startup and shutdown | 13 |
| BE-AUDIT-SCHEMA | Audit entry shape | 14 |
| BE-AUDIT-WRITE | When an audit entry is written | 14 |
| BE-CLOSURE-AUDIT | The closure audit record | 14 |
| BE-AGG-SUMMARY | Windowed summary aggregation | 15 |
| BE-AGG-PRIORITY | Aggregation by priority | 15 |
| BE-AGG-AGENT | Aggregation by agent | 15 |
| BE-TIMESERIES | Time-bucketed series | 15 |
| BE-RAILWAY | Platform configuration | 16 |
| BE-ENV | Environment variable contract | 16 |
| BE-CORS | Cross-origin policy | 16 |
| BE-RELEASE | Release and migration execution | 16 |
| BE-HEALTH | Health endpoint | 16 |
| BE-TEST-UNIT | Unit test strategy | 17 |
| BE-TEST-INTEGRATION | Integration test strategy | 17 |
| BE-TEST-INVARIANTS | Invariant test suite | 17 |
| BE-TEST-FIXTURES | Fixtures and seeded data | 17 |
| BE-TENANT-ISOLATION | Customer data isolation and its scope rule | 04 |
| BE-CUSTOMER-SIGNUP | Customer self-registration | 07 |
| BE-CUST-ACCOUNT-LINK | Binding a login to a Customer record | 08 |
| BE-COMMENT-VISIBILITY | Internal vs customer-visible comments | 11 |
| BE-ATTACH-VISIBILITY | Internal vs customer-visible attachments | 12 |

---

## 6. Traceability Ledger

Every one of the 90 frontend Backend Requirements is claimed by exactly one file. Every backend-owned frontend Open Question is answered in the file the frontend named.

| Backend spec | Requirements satisfied |
|---|---|
| 02-DATABASE | 4 |
| 03-API-CONTRACT | 10 |
| 04-RBAC | 5 |
| 05-STATE-MACHINE | 2 |
| 06-SLA | 6 |
| 07-AUTH | 8 |
| 08-CUSTOMERS | 6 |
| 09-TICKETS | 20 |
| 10-ASSIGNMENT | 2 |
| 11-COMMENTS | 9 |
| 12-ATTACHMENTS | 10 |
| 13-SLA-WORKER | 3 |
| 14-AUDIT-LOG | 1 |
| 15-METRICS | 11 |
| 16-DEPLOYMENT | 3 |
| 17-TESTING | 1 |
| **Total** | **101** |

A requirement claimed twice, or by nobody, is a specification defect and is detected mechanically rather than by review.

---

## 7. Engineering Invariants

**I1 — Determinism.** Every rule in this system is deterministic. No business decision is delegated to a model, a heuristic that cannot be replayed, or wall-clock behaviour that differs between runs.

**I2 — Server-side enforcement.** Authorisation, relational integrity, state legality, and every calculation are enforced here. No client assertion is trusted, including role, priority, authorship, and timestamps.

**I3 — Transactional integrity.** A state change and the audit entry recording it are written in one transaction. Either both exist or neither does.

**I4 — No client-supplied identity.** Author, uploader, actor, and a customer caller's own customer binding are always taken from the authenticated session, never from the request body.

**I4a — Tenant scope is never client-supplied.** A `customer` caller's scope comes from their linked record. A customer filter sent by such a caller is ignored, not honoured and not rejected, so a portal client can never widen its own view.

**I5 — Database does the work.** Filtering, pagination, counting, and aggregation happen in SQL. No endpoint loads a table to process it in Python.

**I6 — Reproducible schema.** Every schema change is an Alembic migration. No manual statement is ever run against a deployed database.

**I7 — No containers.** This project does not use Docker or Docker Compose anywhere. The backend runs on Railway from source; the database is a managed PostgreSQL service.

---

## 8. Required Spec Template

```
# NN — Title

**Status:** Draft | Locked
**Owns:** BE-... (must match Section 5)
**Satisfies:** FE-nn/BR-n, ...  (or "None")
**Resolves:** FE-nn/Qn, ...     (or "None")

## Owns
## Does Not Own
## Depends On
## Contract
## Rules and Invariants
## Failure Modes
## Acceptance Criteria
## Open Questions
```

---

## 9. Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Is a soft-delete pattern applied to any entity beyond customers? | No; nothing else is deletable in this scope | `01-DOMAIN-MODEL.md` |
| Q2 | Are timestamps stored with timezone or as naive UTC? | Timezone-aware, stored as UTC | `02-DATABASE.md` |
