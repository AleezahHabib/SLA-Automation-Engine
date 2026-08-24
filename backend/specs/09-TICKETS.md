# 09 — Tickets

**Status:** Draft
**Owns:** BE-TICKET-CREATE, BE-TICKET-READ, BE-TICKET-QUERY, BE-REFERENCE
**Satisfies:** FE-02/BR-1, FE-02/BR-2, FE-02/BR-6, FE-03/BR-1, FE-04/BR-5, FE-05/BR-1, FE-05/BR-2, FE-05/BR-3, FE-05/BR-4, FE-05/BR-5, FE-05/BR-7, FE-05/BR-8, FE-05/BR-10, FE-06/BR-1, FE-06/BR-3, FE-06/BR-11, FE-05/BR-11, FE-06/BR-12, FE-06/BR-13, FE-14/BR-2
**Resolves:** FE-00/Q1, FE-05/Q3

---

## Owns

| ID | Scope |
|---|---|
| BE-TICKET-CREATE | Ticket creation and everything that happens at intake. |
| BE-TICKET-READ | Single-ticket retrieval and its response composition. |
| BE-TICKET-QUERY | Listing: filtering, sorting, pagination, search, and scoping. |
| BE-REFERENCE | Generation of the human-readable ticket reference. |

This spec satisfies more frontend requirements than any other, because the ticket list is the component the entire application is built around.

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| Priority scoring and deadline computation | BE-TRIAGE, BE-DEADLINE — spec 06 |
| Status changes | BE-TRANSITIONS — spec 05 |
| Assignment | BE-ASSIGN — spec 10 |
| Who may see which tickets | BE-PERMISSIONS — spec 04 |
| Breach detection | BE-BREACH-EVENT — spec 13 |
| Aggregated counts and reporting | BE-AGG-SUMMARY — spec 15 |

---

## Depends On

- BE-ENTITIES — spec 01
- BE-INDEXES — spec 02
- BE-PAGINATION, BE-ENVELOPE — spec 03
- BE-PERMISSIONS — spec 04
- BE-TRIAGE, BE-DEADLINE — spec 06
- BE-CUST-BINDING — spec 08

---

## Contract

### Creation (BE-TICKET-CREATE)

**Satisfies FE-06/BR-1** — accepts `customer_id`, `subject`, `description`. Returns the created ticket including its server-assigned `priority` and `sla_deadline`.

**Resolves FE-00/Q1** — intake happens through the authenticated API only: staff intake and customer portal intake. There is no email ingestion channel and no unauthenticated submission endpoint.

**Satisfies FE-06/BR-12** — for a `customer` caller, `customer_id` is **absent from the creation schema entirely** and is derived from the session. A customer therefore cannot file a ticket against another customer, because the field they would need does not exist in their contract. This is the same technique used for priority and authorship: remove the field rather than validate it. An email channel needs an inbound mail service, address parsing, spam handling, and a rule for binding an unknown sender to a customer — a subsystem larger than the rest of this project.

Creation, in one transaction: resolve and validate the customer, score priority via spec 06, compute the deadline, generate the reference, insert with status `open`, write the `ticket_created` audit entry.

The client supplies no priority, no status, no deadline, and no reference. Every one of those is server-authored, which is what makes the SLA a promise the system makes rather than one the caller declares.

**Satisfies FE-06/BR-11** — the selectable-customer endpoint from spec 08 supplies intake choices, searchable and capped, so intake never loads the full customer table.

### Reference generation (BE-REFERENCE)

`TKT-` plus a zero-padded number drawn from a database sequence, resolving spec 01 Q1. The sequence guarantees uniqueness without a read-then-write, which under concurrency would produce collisions.

The reference is generated once and never changes, because it appears in conversations and external systems.

### Single ticket (BE-TICKET-READ)

**Satisfies FE-06/BR-3** — returns the full record: customer summary, assigned agent summary, all timestamps, `sla_deadline`, and the authoritative `sla_breached`.

**Satisfies FE-06/BR-13** — for a `customer` caller the assigned agent is **omitted from the payload**, `available_transitions` is empty, and both capability booleans are false. Omitted rather than nulled, per spec 03 R10, so the client is never handed a field it must remember to hide.

The response also carries `available_transitions`, `can_assign`, and `can_override_priority`, computed per spec 04. Composition happens in one query with the customer and agent joined, not with follow-up lookups.

### Listing (BE-TICKET-QUERY)

**Satisfies FE-05/BR-1** — server-side pagination using the spec 03 envelope, with `total` reflecting rows visible to this caller.

**Satisfies FE-05/BR-2 and FE-02/BR-1, FE-02/BR-2, FE-03/BR-1** — filters, all combinable in one request:

| Filter | Values |
|---|---|
| `status` | One or more frozen status values |
| `priority` | One or more frozen priority values |
| `assigned_agent_id` | An agent id |
| `assigned_to_me` | Boolean; scopes to the requesting user without the client sending its own id |
| `unassigned` | Boolean; tickets with no assignee |
| `customer_id` | A customer id, satisfying **FE-04/BR-5** |
| `breached` | Boolean; authoritative flag only |
| `limit` | A row cap for dashboard panels |

`assigned_to_me` exists so a dashboard panel never has to send a user id it read from a token. The server already knows who is asking, and a client-supplied id would be a field the server must then verify.

**Satisfies FE-05/BR-3** — sorting is restricted to an allow-list: `sla_deadline`, `updated_at`, `priority`, `status`. Any other value is rejected as a validation error rather than interpolated into a query.

**Satisfies FE-05/BR-4** — free-text search matches `subject` and `reference`, case-insensitively, with metacharacters escaped.

**Satisfies FE-05/BR-5 and FE-02/BR-6** — ordering is stable: every sort appends `id` as a final tiebreaker, so pagination never repeats or skips a row and a dashboard panel showing the first N rows is stable between requests.

Default ordering is `sla_deadline` ascending. The most urgent ticket is first by default everywhere in the system.

**Satisfies FE-05/BR-7 and FE-05/BR-8** — each row carries the assigned agent's display name and the customer's display name, joined in the same query. Without this a 25-row page would issue 50 follow-up requests.

**Resolves FE-05/Q3** — `closed` tickets are **excluded by default**. Closed tickets accumulate without limit and are almost never what someone opening a queue wants to see. Including them requires passing `status` explicitly, which is a deliberate act.

**Satisfies FE-05/BR-11 and FE-14/BR-2** — a `customer` caller is scoped to their linked customer record, read from the database user row. A `customer_id` filter from such a caller is **ignored** — neither honoured nor rejected, since rejecting it would confirm that other customers exist and that the parameter means something.

A customer's default view excludes nothing by status beyond the shared `closed` rule, because a customer's own ticket count is small and hiding rows from someone looking at their own cases is unhelpful.

**Satisfies FE-05/BR-10** — scoping is applied inside the SQL query before pagination, regardless of the filters sent. An `agent` receives only tickets assigned to them or unassigned, whatever `assigned_agent_id` they supply. `total` counts only visible rows, so the count cannot be used to probe for hidden tickets.

---

## Rules and Invariants

**R1** — Priority, status, deadline, reference, and every timestamp are server-authored. None is accepted from a client.

**R2** — Every ticket has a customer at creation, and it never changes.

**R3** — Scope filtering happens in SQL, before counting and pagination, for both the agent rule and the customer rule.

**R3a** — A `customer` caller's scope comes from their database user row, never from a token claim and never from a request parameter.

**R4** — Sort fields come from an allow-list; no client string reaches a query as an identifier.

**R5** — Every ordering is stable.

**R6** — List rows include the display names their consumers need, joined in one query.

**R7** — Creation is one transaction: ticket and audit entry together, or neither.

**R8** — No list query is unbounded; the maximum page size from spec 03 always applies.

---

## Failure Modes

| Situation | Required behaviour |
|---|---|
| `customer_id` absent or unknown | 422 naming the field |
| Customer is archived | 422 explaining why |
| Client sends `priority`, `status`, or `sla_deadline` | Fields absent from the schema; ignored |
| Sort field outside the allow-list | 422 listing valid values |
| Status filter value outside the frozen vocabulary | 422 listing valid values |
| Page beyond the result set | Empty `items` with correct `total`, not a 404 |
| Agent filters by another agent's id | Scope overrides the filter; only their own tickets return |
| Customer filters by another customer's id | Filter ignored; only their own tickets return, with no error |
| Customer requests a ticket outside their record | 404, identical to a non-existent ticket |
| Customer intake sends a `customer_id` | Field absent from their schema; ignored |
| Search string containing pattern metacharacters | Escaped and matched literally |
| Reference sequence collides | Impossible; the unique constraint is the backstop and the insert retries once |
| Audit write fails during creation | Whole transaction rolls back; no ticket exists |

---

## Acceptance Criteria

1. The creation schema accepts only `customer_id`, `subject`, and `description`.
2. Priority and `sla_deadline` appear in the creation response and are server-authored.
3. A ticket cannot be created without a valid, non-archived customer.
4. References are unique under concurrent creation, verified by a parallel-insert test.
5. Every list ordering includes a unique tiebreaker, verified by a pagination test over tied deadlines.
6. Default ordering is `sla_deadline` ascending on every list path.
7. `closed` tickets are absent unless explicitly requested.
8. An agent supplying another agent's id in a filter receives only their own and unassigned tickets.
9. `total` on a scoped list counts only rows the caller may see, for both agents and customers.
14. A `customer` supplying another customer's id in a filter receives only their own tickets, with no error.
15. A `customer` requesting a ticket outside their linked record receives 404.
16. The portal intake schema contains no customer field.
17. No payload served to a `customer` contains an assigned agent.
10. A 25-row page issues no per-row follow-up query.
11. Sort and filter values outside their allow-lists produce 422, never a 500 and never a raw query.
12. The single-ticket response includes `available_transitions`, `can_assign`, and `can_override_priority`.
13. Creation writes exactly one audit entry, in the same transaction as the insert.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Should ticket description be editable after creation? | No in this scope; the intake record stays as filed | This file, if revisited |
| Q2 | Is a bulk creation path needed for seeding demonstration data? | Yes, via the seed script only, never through the API | `17-TESTING.md` |
