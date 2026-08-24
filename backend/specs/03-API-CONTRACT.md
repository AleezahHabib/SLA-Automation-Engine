# 03 — API Contract

**Status:** Draft
**Owns:** BE-ENDPOINTS, BE-ENVELOPE, BE-PAGINATION, BE-ERRORS, BE-OPENAPI
**Satisfies:** FE-04/BR-8, FE-07/BR-5, FE-11/BR-1, FE-11/BR-2, FE-11/BR-3, FE-11/BR-5, FE-11/BR-7, FE-11/BR-8, FE-13/BR-1, FE-13/BR-2
**Resolves:** FE-06/Q1, FE-11/Q2

---

## Owns

| ID | Scope |
|---|---|
| BE-ENDPOINTS | The complete endpoint inventory: paths, methods, and which spec defines each one's behaviour. |
| BE-ENVELOPE | Request and response envelope shapes, and serialisation conventions. |
| BE-PAGINATION | The one pagination contract used by every list endpoint. |
| BE-ERRORS | The one error envelope and the meaning of each status code. |
| BE-OPENAPI | Schema generation and the stability guarantee the frontend generates types from. |

This file replaces every "candidate endpoint — to be confirmed" note in the frontend specification set. Those notes are now resolved.

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| What each endpoint actually does | Specs 07–15 |
| Who may call each endpoint | BE-PERMISSIONS — spec 04 |
| Field meanings | BE-ENTITIES — spec 01 |
| CORS and deployed origins | BE-CORS — spec 16 |

This file owns the **shape** of the API. Behaviour belongs to feature specs.

---

## Depends On

- BE-ENTITIES, BE-ENUMS — spec 01
- BE-ROLES — spec 04, for the permission column below

---

## Contract

### Conventions

**Satisfies FE-11/BR-7** — every payload field is `snake_case`, in every request and every response, without exception. One rule means the frontend converts in one place.

**Resolves FE-11/Q2** — the API version lives in the path, not a header. `/api/v1/...`. A path version is visible in logs, in a browser address bar, and in a curl command; a header version is invisible exactly when someone is debugging.

Every response body is a JSON object. A bare array is never returned at the top level, because it cannot be extended later without breaking clients.

### Endpoint inventory (BE-ENDPOINTS)

| Method | Path | Purpose | Roles | Behaviour spec |
|---|---|---|---|---|
| GET | `/health` | Liveness, unauthenticated | public | 16 |
| POST | `/api/v1/auth/register` | Create a staff user | public | 07 |
| POST | `/api/v1/auth/register/customer` | Create a customer user and its record | public | 07 |
| POST | `/api/v1/auth/login` | Obtain a token | public | 07 |
| GET | `/api/v1/auth/me` | Current user from token | any | 07 |
| GET | `/api/v1/customers` | List and search customers | `admin` | 08 |
| POST | `/api/v1/customers` | Create a customer | `admin` | 08 |
| GET | `/api/v1/customers/{customer_id}` | Single customer | `admin` | 08 |
| PATCH | `/api/v1/customers/{customer_id}` | Update a customer | `admin` | 08 |
| GET | `/api/v1/customers/selectable` | Searchable list for ticket intake | any | 08 |
| GET | `/api/v1/tickets` | List, filter, sort, paginate | any, scoped | 09 |
| POST | `/api/v1/tickets` | Create a ticket | any | 09 |
| GET | `/api/v1/tickets/summary` | Current-state counts | any, scoped | 15 |
| GET | `/api/v1/tickets/{ticket_id}` | Single ticket | any, scoped | 09 |
| PATCH | `/api/v1/tickets/{ticket_id}/status` | Transition status | any, gated | 05 |
| PATCH | `/api/v1/tickets/{ticket_id}/assignment` | Assign, reassign, or clear | `admin` | 10 |
| PATCH | `/api/v1/tickets/{ticket_id}/priority` | Override priority | `admin` | 06 |
| GET | `/api/v1/tickets/{ticket_id}/comments` | List comments | any, scoped | 11 |
| POST | `/api/v1/tickets/{ticket_id}/comments` | Add a comment | any, scoped | 11 |
| GET | `/api/v1/tickets/{ticket_id}/attachments` | List attachments | any, scoped | 12 |
| POST | `/api/v1/tickets/{ticket_id}/attachments` | Upload one file | any, scoped | 12 |
| GET | `/api/v1/tickets/{ticket_id}/audit` | Ticket audit history | `admin` | 14 |
| GET | `/api/v1/attachments/{attachment_id}/content` | Download a file | any, scoped | 12 |
| GET | `/api/v1/agents` | Assignable agents | `admin` | 10 |
| GET | `/api/v1/agents/workload` | Per-agent current load | `admin` | 15 |
| GET | `/api/v1/metrics/summary` | Windowed summary | `admin` | 15 |
| GET | `/api/v1/metrics/by-priority` | Windowed priority breakdown | `admin` | 15 |
| GET | `/api/v1/metrics/by-agent` | Windowed agent breakdown | `admin` | 15 |
| GET | `/api/v1/metrics/timeseries` | Time-bucketed series | `admin` | 15 |

**Route ordering rule.** `/api/v1/tickets/summary` must be declared before `/api/v1/tickets/{ticket_id}`, and `ticket_id` must be typed as a UUID. Without both, the literal path is captured by the parameterised route and the endpoint becomes unreachable. This is recorded here because it is invisible until it breaks.

### Ticket response shape

**Resolves FE-06/Q1** — the single-ticket response carries the permissions and available transitions inline. No separate request is needed. The frontend must never compute what a user may do.

| Field group | Contents |
|---|---|
| Identity | `id`, `reference` |
| Content | `subject`, `description` |
| Classification | `status`, `priority` |
| Relations | `customer` (nested summary), `assigned_agent` (nested summary or null) |
| Timestamps | `created_at`, `updated_at`, `first_response_at`, `resolved_at`, `closed_at` |
| SLA | `sla_deadline`, `sla_breached`, `sla_breached_at` |
| Capability | `available_transitions` (array of status values), `can_assign` (boolean), `can_override_priority` (boolean) |

**Role variance in this response.** For a `customer` caller the `assigned_agent` field is **omitted from the payload entirely**, not sent as null, and `available_transitions` is empty with both capability booleans false. Omission rather than nulling matters: a null field invites a client to render an "Unassigned" state that is a lie, and it tells the reader a value exists that they were not given.

Every other field is identical across roles, so one generated TypeScript type covers all three.

**Satisfies FE-07/BR-5** — every timestamp in every endpoint is serialised as an ISO-8601 string with an explicit UTC offset. One format across the whole API; no endpoint emits a date-only or offset-less value.

Nested summaries carry `id`, and the display name the UI needs, so a list never requires a follow-up request per row.

### Pagination (BE-PAGINATION)

**Satisfies FE-11/BR-8** — one envelope for every list endpoint:

| Field | Meaning |
|---|---|
| `items` | The page of results |
| `total` | Total matching rows |
| `page` | Current page, one-based |
| `page_size` | Rows per page |
| `total_pages` | Derived, included so clients do not recompute it |

Default page size is 25, maximum 100, resolving spec 02 Q1. A request above the maximum is clamped rather than rejected, and the response states the size actually used.

### Error envelope (BE-ERRORS)

**Satisfies FE-11/BR-2** — every non-2xx response, including validation failures, uses this envelope:

| Field | Meaning |
|---|---|
| `error.code` | Stable machine-readable string |
| `error.message` | Human-readable, safe to display |
| `error.details` | Optional array of field-level problems |
| `error.request_id` | Correlation id, also logged server-side |

**Satisfies FE-11/BR-3** — each entry in `details` carries `field` and `message`, so a form attaches the message to the right input.

| Status | Code family | Meaning | Frontend reaction |
|---|---|---|---|
| 400 | `bad_request` | Malformed request | Show message |
| 401 | `unauthenticated` | Absent, invalid, or expired token | Clear session, redirect |
| 403 | `forbidden` | Valid session, insufficient permission | Show message, no redirect |
| 404 | `not_found` | Resource absent or not visible to this caller | Not-found state |
| 409 | `conflict` | Concurrent modification or illegal transition | Refetch and retry |
| 413 | `payload_too_large` | File exceeds the limit | Show limit |
| 422 | `validation_error` | Schema or field validation failed | Attach to fields |
| 429 | `rate_limited` | Too many requests | Back off |
| 500 | `server_error` | Unexpected failure | Offer retry |

**Satisfies FE-11/BR-5** — 409 is returned for a genuinely conflicting write: an illegal transition, or a modification against stale state. It is never used for a permission failure or a validation failure.

401 and 403 are never conflated. A missing or expired token is 401. A valid identity lacking permission is 403. The frontend reacts differently to each, so collapsing them would produce redirect loops for a merely unauthorised action.

**Satisfies FE-04/BR-8** — a uniqueness violation is returned as a 422 with `details` naming the offending field, never as a 500.

A 404 is returned rather than a 403 when revealing existence would itself leak information about a record the caller may not see.

### OpenAPI (BE-OPENAPI)

**Satisfies FE-11/BR-1 and FE-13/BR-1** — the application serves a complete OpenAPI schema. Every endpoint declares an explicit response model, so no path is typed as a free-form object. Every enum appears as a schema enum, so generated TypeScript unions match the frozen vocabulary exactly.

**Satisfies FE-13/BR-2** — the error envelope is declared as a named schema and referenced by every endpoint's error responses, so mock handlers can reproduce any failure faithfully.

Operation ids are stable and explicit. An auto-derived operation id changes when a function is renamed, which silently renames the generated client method and breaks the frontend build for a cosmetic edit.

---

## Rules and Invariants

**R1** — Every endpoint declares an explicit response model. A route returning an untyped object is a defect.

**R2** — Every payload field is `snake_case`, everywhere.

**R3** — Every error response uses the single envelope, with no exception for validation errors.

**R4** — Every list endpoint uses the single pagination envelope.

**R5** — No top-level array is ever returned.

**R6** — Every timestamp is ISO-8601 with an explicit UTC offset.

**R7** — Adding a field is a compatible change; renaming or removing one requires a new version path.

**R8** — No endpoint accepts a field that identifies the actor. Identity always comes from the token.

**R9** — No endpoint accepts a field that widens a caller's tenant scope. A customer filter sent by a `customer` caller is ignored, not honoured and not rejected.

**R10** — Fields a caller may not see are omitted from the payload, never nulled or blanked.

---

## Failure Modes

| Situation | Required behaviour |
|---|---|
| An unhandled exception escapes a service | Caught by a global handler, logged with the request id, returned as a 500 in the envelope, never as a stack trace |
| A validation error is raised by Pydantic | Translated into the envelope with field details, not returned in the framework's default shape |
| A path collision between a literal and a parameterised route | Prevented by declaration order and UUID typing; covered by a test |
| A client requests a page beyond the result set | Empty `items` with correct `total`, not a 404 |
| A client requests a page size above the maximum | Clamped, with the applied size stated in the response |
| An enum value outside the frozen vocabulary is submitted | 422 naming the field and listing valid values |
| A response model omits a field the frontend generated types expect | Caught by the type-generation check before release |

---

## Acceptance Criteria

1. Every endpoint in the inventory exists, and no endpoint exists outside the inventory.
2. Every endpoint declares an explicit response model in the OpenAPI schema.
3. Every payload field, in every direction, is `snake_case`.
4. Every non-2xx response, validation included, uses the single error envelope.
5. Every list endpoint returns the single pagination envelope.
6. No endpoint returns a top-level array.
7. Every timestamp is ISO-8601 with an explicit UTC offset, verified across all endpoints by a test.
8. 401 and 403 are never returned interchangeably for the same condition.
9. A uniqueness violation returns 422 with the offending field named.
10. The single-ticket response includes `available_transitions`, `can_assign`, and `can_override_priority`.
14. A `customer` caller's ticket payload omits `assigned_agent` entirely and never carries it as null.
15. One generated TypeScript type serves all three roles; no role-specific response model exists.
11. Every enum in the schema matches the frozen vocabulary exactly.
12. Operation ids are explicit and stable across refactors.
13. `/api/v1/tickets/summary` is reachable and is not captured by the parameterised ticket route.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Is rate limiting implemented in this scope? | Declared in the error table, not implemented | `16-DEPLOYMENT.md` |
| Q2 | Does the list endpoint support field selection or sparse responses? | No; a fixed shape keeps generated types simple | This file, if revisited |
