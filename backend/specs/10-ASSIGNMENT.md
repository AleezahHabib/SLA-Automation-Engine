# 10 — Assignment

**Status:** Draft
**Owns:** BE-ASSIGN, BE-UNASSIGN, BE-ASSIGNABLE
**Satisfies:** FE-06/BR-7, FE-06/BR-8
**Resolves:** FE-06/Q2

---

## Owns

| ID | Scope |
|---|---|
| BE-ASSIGN | Assigning and reassigning a ticket to an agent. |
| BE-UNASSIGN | Clearing an assignment back to unassigned. |
| BE-ASSIGNABLE | Listing agents eligible to receive an assignment. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| Who may assign | BE-PERMISSIONS — spec 04 |
| Status changes that accompany work starting | BE-TRANSITIONS — spec 05 |
| The workload figures a dispatcher looks at | BE-AGG-AGENT — spec 15 |
| Writing the audit entry | BE-AUDIT-WRITE — spec 14 |

**Assignment is orthogonal to status.** Reassigning a ticket does not change its status, and changing status does not change its assignee. Coupling them would mean a handover silently reset the work state.

---

## Depends On

- BE-ENTITIES — spec 01
- BE-PERMISSIONS — spec 04
- BE-STATE-GUARDS — spec 05, which requires an assignee before work may begin
- BE-AUDIT-WRITE — spec 14

---

## Contract

### Assign and reassign (BE-ASSIGN)

**Satisfies FE-06/BR-7** — one endpoint handles assign, reassign, and clear. It accepts an agent id, or null.

Reassignment is not a separate operation. Assigning a ticket that already has an assignee replaces the assignee and records both values in the audit entry. Modelling reassignment separately would produce two endpoints enforcing the same rules.

**Resolves FE-06/Q2** — an assignment **can** be cleared back to unassigned, by `admin` only. A ticket may need to return to the pool when an agent goes on leave, and the alternative — assigning it to a placeholder user — corrupts workload figures.

Clearing is refused when the ticket is `in_progress`, because spec 05 requires an assignee for that status and clearing would leave the ticket in a state its own precondition forbids. The ticket must be reassigned instead.

The target must be an active user holding the `agent` role. Assigning to an `admin` is refused: admins dispatch rather than carry queues, and permitting it would make workload figures misleading.

All of this happens in one transaction with the audit entry, under a row lock on the ticket, so two concurrent dispatchers cannot both believe they assigned it.

### Assignable agents (BE-ASSIGNABLE)

**Satisfies FE-06/BR-8** — an endpoint lists agents eligible for assignment, restricted to `admin`, returning id and display name, searchable.

Only active users with role `agent` appear — never an `admin` and never a `customer`. The list is the same source the workload endpoint in spec 15 aggregates over, so a dispatcher never sees an agent in one view and not the other.

Nothing in this spec is reachable by a `customer`. Assignment is internal operational information, and per spec 04 a customer is never shown which agent holds their ticket, let alone permitted to influence it.

---

## Rules and Invariants

**R1** — Assignment never changes status, and status changes never alter assignment.

**R2** — The assignee must be an active user with role `agent`.

**R3** — Clearing an assignment is refused while the ticket is `in_progress`.

**R4** — Assignment is `admin`-only, enforced in the service as well as the route. Both `agent` and `customer` callers are refused.

**R5** — Every assignment change writes one audit entry in the same transaction, recording both the previous and the new assignee.

**R6** — Assignment takes a row lock before validating.

**R7** — Assigning a ticket to the agent who already holds it is rejected as a conflict, not accepted silently.

---

## Failure Modes

| Situation | Required behaviour |
|---|---|
| Target user does not exist | 422 naming the field |
| Target user is inactive | 422 explaining the reason |
| Target user is an `admin` | 422 explaining that only agents receive assignments |
| Agent attempts to assign | 403 |
| Customer attempts to assign | 403 |
| Customer requests the assignable-agents list | 403 |
| Clear attempted while `in_progress` | 409 explaining that the ticket must be reassigned |
| Assignment attempted on a `closed` ticket | 409; closed tickets are frozen |
| Two dispatchers assign concurrently | One succeeds; the other receives 409 with the current assignee |
| Assigning to the current assignee | 409, never a silent no-op |
| Audit write fails | Transaction rolls back; the assignment does not change |

---

## Acceptance Criteria

1. One endpoint serves assign, reassign, and clear.
2. Assignment never alters `status`, verified by a test across all statuses.
3. Only active users with role `agent` can be assigned.
4. Clearing an assignment on an `in_progress` ticket is refused with a conflict.
5. Assignment on a `closed` ticket is refused.
6. Every assignment change writes exactly one audit entry containing both old and new assignee.
7. A failed audit write rolls back the assignment.
8. Two concurrent assignments produce exactly one change and one audit entry.
9. Assigning to the existing assignee returns a conflict.
10. An `agent` and a `customer` each receive 403 on every path in this spec.
12. A `customer` never appears in the assignable-agents list under any query.
11. The assignable list and the workload aggregation draw from the same agent set.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Should assignment be capped by a maximum queue size per agent? | No; the dispatcher sees workload and decides | This file, if revisited |
| Q2 | Should there be automatic round-robin assignment? | No; dispatch is a deliberate human act in this scope | This file, if revisited |
