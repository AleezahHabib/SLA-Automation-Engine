# 02 — Database

**Status:** Draft
**Owns:** BE-SCHEMA, BE-INDEXES, BE-CONSTRAINTS, BE-MIGRATIONS
**Satisfies:** FE-02/BR-5, FE-03/BR-4, FE-05/BR-9, FE-10/BR-6
**Resolves:** None

---

## Owns

| ID | Scope |
|---|---|
| BE-SCHEMA | Physical tables, column types, nullability, defaults. |
| BE-INDEXES | Which indexes exist and which query each serves. |
| BE-CONSTRAINTS | Foreign keys, unique constraints, check constraints. |
| BE-MIGRATIONS | Migration policy, ordering, and reproducibility. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| What entities and fields mean | BE-ENTITIES — spec 01 |
| Which queries the API exposes | BE-ENDPOINTS — spec 03 |
| Business rules | The relevant feature spec |
| Connection configuration and platform wiring | BE-ENV, BE-RAILWAY — spec 16 |

**No business logic in the database.** No triggers, no stored procedures, no computed business columns. Constraints protect *structural* truth — a ticket has a customer, an email is unique. Rules live in services, where they are testable and visible in one language.

---

## Depends On

- BE-ENTITIES, BE-ENUMS, BE-RELATIONS — spec 01

---

## Contract

### Tables

One table per entity in spec 01: `users`, `customers`, `tickets`, `comments`, `attachments`, `audit_logs`.

| Convention | Rule |
|---|---|
| Table names | Plural, `snake_case` |
| Primary keys | UUID, generated server-side |
| Enums | Stored as constrained text, not native PostgreSQL enum types |
| Timestamps | `TIMESTAMPTZ`, stored in UTC, defaulting to statement time |
| Money or duration | None stored; durations are always derived from two timestamps |

Enums are text with a check constraint rather than PostgreSQL enum types because altering a native enum requires a migration that locks the table, while a check constraint is cheap to change. The trade is deliberate.

### Constraints (BE-CONSTRAINTS)

| Constraint | On | Purpose |
|---|---|---|
| Unique, case-insensitive | `users.email` | One account per address |
| Unique, case-insensitive | `customers.email` | One record per address |
| Unique | `tickets.reference` | Human identifier is unambiguous |
| Foreign key, restrict | `tickets.customer_id` | A customer with tickets cannot be deleted |
| Foreign key, restrict | `tickets.assigned_agent_id` | Assignment always points at a real user |
| Foreign key, cascade | `comments.ticket_id`, `attachments.ticket_id`, `audit_logs.ticket_id` | Children never outlive their ticket |
| Foreign key, restrict | Every `*_id` pointing at `users` | Authorship survives |
| Check | `tickets.status` in the four frozen values | Vocabulary enforced at rest |
| Check | `tickets.priority` in the four frozen values | Vocabulary enforced at rest |
| Check | `users.role` in the three frozen values | Vocabulary enforced at rest |
| Check | `customer_id` present when role is `customer`, null otherwise | The invalid combination cannot exist |
| Unique | `users.customer_id` where not null | One login per customer record |
| Foreign key, restrict | `users.customer_id` | A linked customer record cannot be deleted |
| Not null | `tickets.sla_deadline` | A ticket without a deadline is meaningless |

Check constraints on enum columns exist so that a bug in application code cannot write an invalid status. The database is the last line of defence for the frozen vocabulary.

### Indexes (BE-INDEXES)

Each index exists to serve a named query. An index with no named query is removed.

| Index | Serves |
|---|---|
| `tickets(status)` | Status filters on the list endpoint |
| `tickets(priority)` | Priority filters |
| `tickets(assigned_agent_id)` | An agent's own queue, and the workload aggregation |
| `tickets(customer_id)` | A customer's ticket history, and every portal query |
| `tickets(customer_id, status)` | Portal dashboard counts |
| `comments(ticket_id, is_internal)` | Filtering internal comments out of portal responses |
| `attachments(ticket_id, is_customer_visible)` | Filtering internal files out of portal responses |
| `tickets(sla_deadline)` | Default ordering, and the worker's due-ticket scan |
| `tickets(status, sla_deadline)` | The worker's hot query: unresolved tickets past their deadline |
| `tickets(assigned_agent_id, status)` | Agent dashboard counts |
| `tickets(created_at)` | Windowed reporting |
| `comments(ticket_id, created_at)` | Thread listing in order |
| `attachments(ticket_id)` | Attachment listing |
| `audit_logs(ticket_id, created_at)` | Ticket history in order |
| Unique lower-case expression on `users.email`, `customers.email` | Case-insensitive uniqueness |

### Query obligations

**Satisfies FE-05/BR-9** — every list query applies filtering, ordering, and `LIMIT`/`OFFSET` in SQL. No endpoint loads a table into Python to slice it.

Tenant scoping is part of the same `WHERE` clause, never a filter applied afterwards. A row a `customer` may not see is never fetched, so it cannot be leaked by a logging statement, a serialisation mistake, or a count.

**Satisfies FE-02/BR-5 and FE-03/BR-4** — dashboard counts and per-agent workload are single aggregate queries using `COUNT` with `FILTER` clauses, returning one row. Neither fetches ticket rows.

**Satisfies FE-10/BR-6** — every reporting aggregate is computed in SQL, including medians via a percentile function and time buckets via date truncation.

Sorting is always stable: every ordering appends `id` as a final tiebreaker, so pagination cannot repeat or skip a row when two tickets share a deadline.

### Migrations (BE-MIGRATIONS)

| Rule | Statement |
|---|---|
| Every schema change is a migration | No statement is ever run by hand against a deployed database |
| Migrations are linear | One head at all times; a branch is resolved before merge |
| Migrations are forward-only in production | A mistake is corrected by a new migration, never by editing a released one |
| Autogenerate is a draft | Every generated migration is read and corrected before commit |
| Migrations run on release | Executed by the release command in spec 16, never on application startup |

Running migrations on application startup is prohibited: with more than one instance, two processes would race to apply the same migration.

The reference sequence from spec 01 Q1 is a database sequence formatted by the application as `TKT-` plus a zero-padded number, so uniqueness is guaranteed by the database rather than by a read-then-write in Python.

---

## Rules and Invariants

**R1** — The database contains no business logic: no triggers, no stored procedures, no rule expressed as a computed column.

**R2** — Every foreign key is declared. Referential integrity is never left to application code.

**R3** — Every index traces to a named query in this file.

**R4** — Every ordering used for pagination is stable.

**R5** — No query returns an unbounded result set. Every list endpoint has a maximum page size.

**R7** — Tenant scoping and visibility filtering are applied in the `WHERE` clause of the original query, never after fetching.

**R6** — All timestamps are stored in UTC as timezone-aware values.

---

## Failure Modes

| Situation | Required behaviour |
|---|---|
| Duplicate email inserted | Unique violation caught in the service and returned as a field validation error |
| Reference collision on generation | Retried once, then surfaced as a server error; the unique constraint never permits a duplicate |
| Attempt to delete a customer with tickets | Restricted by the foreign key; the API offers archive instead |
| Invalid status written by a bug | Rejected by the check constraint |
| Migration fails during release | The release fails and the previous version keeps serving; a partially migrated database is never left running |
| Two instances start simultaneously | Neither runs migrations, because migrations run only in the release step |
| Connection pool exhausted under load | Requests queue and time out with a server error; the pool size is documented in spec 16 |

---

## Acceptance Criteria

1. No trigger, stored procedure, or business-rule computed column exists in the schema.
2. Every relationship in spec 01 is enforced by a declared foreign key.
3. Every index in this file traces to a named query, and no index exists that does not.
4. Every list query applies its filter, order, limit, and offset in SQL.
5. Dashboard counts and agent workload are each a single aggregate query returning one row.
6. Every ordering used with pagination includes a unique tiebreaker.
7. Enum columns carry check constraints matching the frozen vocabulary.
8. Email uniqueness is case-insensitive for both users and customers.
9. Migrations run only in the release step, never at application startup.
10. The migration history has exactly one head.
11. Every timestamp column is timezone-aware.
12. A staff user with a `customer_id`, or a `customer` user without one, is rejected by a check constraint.
13. Two logins cannot link to the same customer record.
14. Tenant scoping appears in the `WHERE` clause of every query a `customer` caller can reach.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | What is the maximum page size for list endpoints? | 100, with a default of 25 | `03-API-CONTRACT.md` |
| Q2 | Is a full-text index needed for ticket search, or is a pattern match sufficient at this scale? | Pattern match on subject and reference | `09-TICKETS.md` |
