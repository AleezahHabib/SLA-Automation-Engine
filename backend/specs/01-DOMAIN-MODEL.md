# 01 — Domain Model

**Status:** Draft
**Owns:** BE-ENTITIES, BE-ENUMS, BE-RELATIONS
**Satisfies:** None
**Resolves:** FE-03/Q2, FE-04/Q3, FE-05/Q2

---

## Owns

| ID | Scope |
|---|---|
| BE-ENTITIES | Every entity, its fields, and their meaning. |
| BE-ENUMS | Every enumerated value in the system. |
| BE-RELATIONS | Relationships between entities and their cardinality. |

This file is the highest authority in the project. Every field name used anywhere — Pydantic schema, SQLAlchemy model, TypeScript type — originates here.

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| Physical tables, column types, indexes | BE-SCHEMA, BE-INDEXES — spec 02 |
| How entities are exposed over HTTP | BE-ENDPOINTS, BE-ENVELOPE — spec 03 |
| Who may read or write a field | BE-PERMISSIONS — spec 04 |
| Which status changes are legal | BE-TRANSITIONS — spec 05 |
| How priority is chosen or a deadline computed | BE-TRIAGE, BE-DEADLINE — spec 06 |

This file defines **what exists**. It never defines what may be done to it.

---

## Depends On

Nothing. This is the root of the dependency graph.

---

## Contract

### Entity: User

A principal who can authenticate. Agents and admins only.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary identity |
| `email` | string | Unique, case-insensitive |
| `full_name` | string | Display name used everywhere a person is shown |
| `password_hash` | string | Never serialised in any response |
| `role` | enum Role | `admin`, `agent`, or `customer` |
| `customer_id` | UUID, nullable | Required when `role` is `customer`; must be null otherwise |
| `is_active` | boolean | A deactivated user cannot authenticate |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Resolves FE-03/Q2** — "active agent" means a `User` with `role` = `agent` and `is_active` = true. There is no separate agent entity; an agent is a role a user holds.

### Entity: Customer

An organisation or person on whose behalf tickets are raised.

A Customer is a **record**, and a login may be layered onto it. The record itself still holds no password and no role — those live on the linked `User`. A Customer with no linked user is valid and normal: an admin creates one to log a ticket raised by phone, and a login may be attached later when that person self-registers with the same email.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `name` | string | Required |
| `email` | string | Unique, case-insensitive |
| `company` | string, nullable | |
| `phone` | string, nullable | |
| `is_archived` | boolean | Soft archive; see Rules |
| `has_portal_access` | boolean | Derived indicator that a `customer` user is linked to this record |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Resolves FE-04/Q3** — `company` is a free-text field on the customer record, not a separate entity. Introducing a company entity would add a join and a management surface that this scope does not need.

### Entity: Ticket

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `reference` | string | Short human-readable identifier, unique, server-generated |
| `customer_id` | UUID | Required; a ticket always belongs to a customer |
| `subject` | string | Required |
| `description` | text | Required |
| `status` | enum TicketStatus | Starts at `open` |
| `priority` | enum Priority | Assigned by triage, never by the client |
| `assigned_agent_id` | UUID, nullable | Null means unassigned |
| `created_at` | timestamp | The instant the SLA clock starts |
| `updated_at` | timestamp | |
| `first_response_at` | timestamp, nullable | First transition to `in_progress` |
| `resolved_at` | timestamp, nullable | Transition to `resolved` |
| `closed_at` | timestamp, nullable | Transition to `closed` |
| `sla_deadline` | timestamp | Computed at creation from `created_at` and `priority` |
| `sla_breached` | boolean | Authoritative breach flag; written by the SLA worker or at resolution |
| `sla_breached_at` | timestamp, nullable | When the breach was recorded |

**Resolves FE-05/Q2** — `reference` is a separate short field, not the primary key. A UUID is unusable in conversation; a reference such as `TKT-000142` can be read aloud, searched, and pasted into a chat. `id` remains the primary key for every relationship.

`sla_deadline` is **stored, not derived on read**. Storing it means the promise made at creation survives any later change to the duration table, which is what makes a historical compliance report honest.

### Entity: Comment

An internal note written by a user against a ticket. Immutable.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `ticket_id` | UUID | Required |
| `author_id` | UUID | Required; taken from the session, never from the body |
| `body` | text | Plain text, length-limited |
| `is_internal` | boolean | True means staff-only. Defaults to true |
| `created_at` | timestamp | |

No `updated_at`, no `is_deleted`. The absence of those fields is the immutability guarantee expressed in the schema itself.

### Entity: Attachment

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `ticket_id` | UUID | Required |
| `uploaded_by_id` | UUID | From the session |
| `original_filename` | string | As supplied by the uploader, stored for display only |
| `storage_key` | string | Server-generated; the uploader's name never influences it |
| `content_type` | string | As determined by server-side inspection |
| `size_bytes` | integer | |
| `is_customer_visible` | boolean | False means staff-only. Defaults to false |
| `created_at` | timestamp | |

### Entity: AuditLog

An immutable record of a state change made by the system or a user.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `ticket_id` | UUID | Required |
| `actor_id` | UUID, nullable | Null when the actor is the SLA worker |
| `action` | enum AuditAction | |
| `from_value` | string, nullable | |
| `to_value` | string, nullable | |
| `detail` | text, nullable | |
| `created_at` | timestamp | |

### Enumerations (BE-ENUMS)

| Enum | Values |
|---|---|
| Role | `admin`, `agent`, `customer` |
| TicketStatus | `open`, `in_progress`, `resolved`, `closed` |
| Priority | `critical`, `high`, `medium`, `low` |
| AuditAction | `ticket_created`, `status_changed`, `assigned`, `unassigned`, `priority_overridden`, `sla_breached`, `comment_added`, `attachment_added` |

Enum values are stored as strings, not integers. A string is self-describing in a database dump, in a log line, and in an API payload; an integer requires the reader to hold a lookup table in their head.

### Relationships (BE-RELATIONS)

| From | To | Cardinality | On delete |
|---|---|---|---|
| User | Customer | many-to-one, optional | Restricted; required for `customer` users, null for staff |
| Ticket | Customer | many-to-one, required | Restricted; a customer with tickets cannot be deleted |
| Ticket | User (assignee) | many-to-one, optional | Restricted |
| Comment | Ticket | many-to-one, required | Cascade |
| Comment | User (author) | many-to-one, required | Restricted |
| Attachment | Ticket | many-to-one, required | Cascade |
| Attachment | User (uploader) | many-to-one, required | Restricted |
| AuditLog | Ticket | many-to-one, required | Cascade |
| AuditLog | User (actor) | many-to-one, optional | Restricted |

A user is never deleted, so restrict is safe. Deleting a user would orphan authorship on immutable records, which would defeat the audit trail.

---

## Rules and Invariants

**R1** — Every ticket has a customer. There is no unbound ticket.

**R2** — `priority` is set only by triage at creation, or by an `admin` override recorded in the audit log. No other path may write it.

**R3** — `sla_deadline` is written once at creation and thereafter changed only when an `admin` overrides priority, in which case the recomputation is audited.

**R4** — `sla_breached` is authoritative. Nothing outside the SLA service may write it.

**R5** — `password_hash` never appears in any response schema. It is excluded at the Pydantic layer, not filtered at the route.

**R6** — Customers are archived, never deleted, because tickets reference them permanently.

**R7** — Comments and audit entries have no update or delete path anywhere in the system.

**R8** — All timestamps are timezone-aware and stored in UTC. A naive timestamp makes SLA arithmetic silently wrong for anyone not in the server's timezone.

**R9** — A `User` with role `customer` must have a `customer_id`; a staff user must not. Enforced by a check constraint, so the invalid combination cannot exist at rest.

**R10** — One Customer record carries at most one linked login, matched by email at registration.

**R11** — `is_internal` defaults to true and `is_customer_visible` defaults to false. Both defaults fail closed: a value omitted by a bug hides the record from customers rather than exposing it.

---

## Failure Modes

| Situation | Required behaviour |
|---|---|
| A ticket is created with a customer id that does not exist | Rejected as a validation error naming the field, not a foreign-key error surfaced as a 500 |
| A client sends `priority` at creation | The field is absent from the creation schema, so it is ignored, never honoured |
| A client sends `author_id` on a comment | Absent from the schema; authorship comes from the session |
| Two customers registered with the same email | Prevented by a case-insensitive unique constraint |
| A reference collides | Generation retries; the unique constraint is the backstop |
| A deactivated user holds a valid token | Token validation rejects them; `is_active` is checked on every request |
| A staff user is given a `customer_id` | Rejected by the check constraint |
| A `customer` user is created with no `customer_id` | Rejected by the check constraint |
| A comment is written with `is_internal` unset | Defaults to true; the record is hidden from customers |

---

## Acceptance Criteria

1. Every field name in every Pydantic schema and SQLAlchemy model appears in this file.
2. No response schema anywhere in the system exposes `password_hash`.
3. `sla_deadline` is a stored column, not a computed property.
4. `Comment` and `AuditLog` have no update or delete path in any layer.
5. `reference` is unique and distinct from `id`.
6. Every enum is stored as a string.
7. Every timestamp column is timezone-aware.
8. No entity in this file grants a customer the ability to authenticate.
9. A customer with tickets cannot be deleted through any code path.
10. The frozen vocabulary here matches `frontend/specs/00-OVERVIEW.md` Section 3 exactly.
11. A `customer` user always has a `customer_id` and a staff user never does, enforced at rest by a check constraint.
12. `is_internal` and `is_customer_visible` both default to the value that hides the record from customers.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | What is the `reference` format? | `TKT-` plus a zero-padded sequence | `02-DATABASE.md` |
| Q2 | Is `first_response_at` used by any report in this scope? | Captured now, reported later | `15-METRICS.md` |
