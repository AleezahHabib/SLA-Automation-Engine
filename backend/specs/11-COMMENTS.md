# 11 — Internal Comments

**Status:** Draft
**Owns:** BE-COMMENT-CREATE, BE-COMMENT-LIST, BE-IMMUTABILITY, BE-COMMENT-VISIBILITY
**Satisfies:** FE-08/BR-1, FE-08/BR-2, FE-08/BR-3, FE-08/BR-4, FE-08/BR-5, FE-08/BR-6, FE-08/BR-7, FE-08/BR-8, FE-08/BR-9
**Resolves:** FE-08/Q1, FE-08/Q3, FE-08/Q4

---

## Owns

| ID | Scope |
|---|---|
| BE-COMMENT-CREATE | Creating a comment on a ticket. |
| BE-COMMENT-LIST | Listing a ticket's comments. |
| BE-IMMUTABILITY | The guarantee that a comment cannot be changed or removed. |
| BE-COMMENT-VISIBILITY | Whether a comment is internal or customer-visible, and how that is enforced. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| The system audit trail of state changes | BE-AUDIT-WRITE — spec 14 |
| Who may read a ticket, and therefore its comments | BE-PERMISSIONS — spec 04 |
| Attachments referenced in a discussion | BE-UPLOAD — spec 12 |

**Comments are not audit entries.** Audit entries are written by the system when state changes and have an action and a value pair. Comments are written by people and have prose. They are different tables, different specs, and different endpoints.

---

## Depends On

- BE-ENTITIES — spec 01
- BE-PERMISSIONS — spec 04
- BE-PAGINATION — spec 03

---

## Contract

### Listing (BE-COMMENT-LIST)

**Satisfies FE-08/BR-1** — returns a ticket's comments ordered oldest first, each carrying author display name, author role, body, and creation timestamp.

**Satisfies FE-08/BR-6** — the listing is paginated using the spec 03 envelope. A ticket open for months could otherwise return an unbounded payload.

Author details are joined in the same query, so a thread of 40 comments does not produce 40 user lookups.

Access follows ticket access: a caller who may read the ticket may read its comments. There is no separate comment permission, because a comment is only ever meaningful in the context of its ticket.

### Visibility (BE-COMMENT-VISIBILITY)

**Satisfies FE-08/BR-8** — every comment carries `is_internal`, defaulting to **true**. A `customer` caller's list is filtered in the `WHERE` clause to public comments only. An internal comment is never serialised into a response a customer receives, so there is nothing for a client bug, a log line, or a cached payload to expose.

Filtering server-side rather than hiding client-side is the whole point. A client that receives an internal comment and hides it has already lost the note to the browser's network tab.

**Satisfies FE-08/BR-9** — a comment created by a `customer` is always public. `is_internal` is **absent from the schema available to that caller**, so it cannot be set to any value, correct or otherwise.

**Resolves FE-08/Q4** — any comment that predates this field is treated as **internal**. It was written under the assumption that only staff would ever read it, and honouring that assumption is the only safe default. Applied by the migration's column default rather than by a backfill decision made later.

The default fails closed in every direction: omitted by a client, omitted by a service, or omitted by a migration, a comment ends up hidden from customers rather than exposed to them.

### Creation (BE-COMMENT-CREATE)

**Satisfies FE-08/BR-2** — creation returns the created comment in exactly the shape the list returns, so a client can insert it without a refetch or a second shape to handle.

**Satisfies FE-08/BR-3** — the author is taken from the authenticated session. The creation schema contains no author field, so a client cannot attribute a note to someone else.

**Satisfies FE-08/BR-5** — bodies are length-limited server-side.

**Resolves FE-08/Q3** — the limit is **4000 characters**. Long enough for a detailed handover note, short enough that a thread stays readable and a single row stays small. Enforced at the Pydantic layer and by a check constraint, so both the API and any future script are bound.

Bodies are stored and returned as plain text. No markup is parsed, rendered, or sanitised, because none is interpreted. The frontend renders them as text, so there is nothing to sanitise against.

Whitespace-only bodies are rejected.

**Resolves FE-08/Q1 and satisfies FE-08/BR-7** — a comment cannot be added to a `closed` ticket. Closure freezes the record. A ticket whose audit trail is complete and whose SLA outcome is final should not gain new prose afterwards, or the closure timestamp stops meaning what it says. The same rule applies to attachments in spec 12, for the same reason.

Comments **are** permitted on `resolved` tickets, since resolution is not yet closure and a note during the review period is legitimate.

### Immutability (BE-IMMUTABILITY)

**Satisfies FE-08/BR-4** — there is no update endpoint and no delete endpoint for comments, on any path.

Immutability is enforced structurally rather than by a rule: the `Comment` entity in spec 01 has no `updated_at` and no soft-delete flag, and no service method exists that writes to an existing row. A rule can be forgotten; an absent code path cannot be invoked.

---

## Rules and Invariants

**R1** — Authorship always comes from the session, never from the request.

**R2** — No update or delete path exists for comments anywhere in the system.

**R3** — Comments are plain text; no markup is ever interpreted server-side.

**R4** — Comment access is derived from ticket access, plus the visibility filter for customers.

**R4a** — `is_internal` defaults to true everywhere: schema, model, and migration.

**R4b** — Visibility filtering happens in SQL. An internal comment is never fetched for a customer caller.

**R5** — Comments cannot be created on a `closed` ticket.

**R6** — Comment listing is always paginated.

**R7** — Every comment belongs to exactly one ticket and cannot be moved.

---

## Failure Modes

| Situation | Required behaviour |
|---|---|
| Body empty or whitespace only | 422 naming the field |
| Body exceeds 4000 characters | 422 stating the limit |
| Client sends an author id | Field absent from the schema; ignored |
| Comment attempted on a `closed` ticket | 409 explaining the ticket is closed |
| Comment attempted on a ticket the caller cannot read | 404, matching the ticket rule so existence is not leaked |
| Ticket does not exist | 404 |
| Attempt to update or delete | No such route exists |
| Body containing markup characters | Stored and returned verbatim, uninterpreted |

---

## Acceptance Criteria

1. No update or delete route for comments exists in the application.
2. The `Comment` model has no `updated_at` and no delete flag.
3. Authorship is taken from the session on every path, and no schema accepts an author field.
4. A comment on a `closed` ticket is refused with a conflict.
5. A comment on a `resolved` ticket is accepted.
6. Bodies over 4000 characters are rejected by both the schema and a database constraint.
7. Whitespace-only bodies are rejected.
8. Comment listing is paginated and ordered oldest first.
9. A thread of 40 comments issues no per-comment author lookup.
10. A caller who cannot read a ticket receives 404 on its comments, not 403.
11. Markup in a body is stored and returned verbatim, never interpreted.
12. No response served to a `customer` contains an internal comment, verified at the payload level rather than the rendered output.
13. A `customer` cannot create an internal comment, because the field is absent from their schema.
14. `is_internal` defaults to true in the Pydantic schema, the model, and the migration.
15. Comments created before the field existed are internal.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Should comments and audit entries be exposed through one merged timeline endpoint? | No; separate endpoints, merged in the UI later if ever | This file, if revisited |
| Q2 | Should a comment be able to reference an attachment explicitly? | No; both are listed against the ticket | This file, if revisited |
