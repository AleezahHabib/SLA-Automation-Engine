# 05 — Ticket State Machine

**Status:** Draft
**Owns:** BE-TRANSITIONS, BE-STATE-GUARDS, BE-EFFECTS
**Satisfies:** FE-06/BR-6, FE-06/BR-10
**Resolves:** FE-00/Q3, FE-06/Q4, FE-14/Q1

---

## Owns

| ID | Scope |
|---|---|
| BE-TRANSITIONS | The complete table of legal status transitions. |
| BE-STATE-GUARDS | Preconditions each transition must satisfy beyond legality. |
| BE-EFFECTS | The side effects each transition produces, and their transactional boundary. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| Which role may perform a transition | BE-PERMISSIONS — spec 04 |
| Deadline computation and breach recording | BE-DEADLINE, BE-BREACH-DEF — spec 06 |
| Writing the audit entry | BE-AUDIT-WRITE — spec 14 |
| The endpoint shape | BE-ENDPOINTS — spec 03 |

**Legality only.** This spec answers "may a ticket in status X move to status Y at all?" Whether *this user* may do it is spec 04. Both checks run; legality first, because an illegal transition is illegal for everyone and the cheaper check should fail first.

---

## Depends On

- BE-ENTITIES, BE-ENUMS — spec 01
- BE-PERMISSIONS — spec 04
- BE-AUDIT-WRITE — spec 14

---

## Contract

### Transition table (BE-TRANSITIONS)

| From | To | Legal | Notes |
|---|---|---|---|
| — | `open` | yes | Creation only |
| `open` | `in_progress` | yes | Work begins |
| `open` | `resolved` | **no** | Work cannot complete without having started |
| `open` | `closed` | **no** | |
| `in_progress` | `resolved` | yes | Work complete |
| `in_progress` | `open` | **no** | Handing back is an assignment change, not a status change |
| `in_progress` | `closed` | **no** | Closure requires resolution first |
| `resolved` | `closed` | yes | Administrative closure |
| `resolved` | `in_progress` | **no** | See Q1 |
| `closed` | anything | **no** | Terminal |
| Any | itself | **no** | A no-op transition is rejected, not silently accepted |

No transition is available to a `customer` under any circumstance. The transition endpoint rejects such a caller before evaluating legality.

The path is strictly linear: `open` → `in_progress` → `resolved` → `closed`. There are exactly three legal transitions after creation.

**Resolves FE-06/Q4** — a `closed` ticket cannot be reopened. `closed` is terminal in every direction. If the issue recurs, a new ticket is created, which starts a fresh SLA clock. Reopening would either resurrect an expired clock or silently forgive a breach, and both corrupt the compliance record that this system exists to produce.

**Resolves FE-14/Q1** — a `customer` cannot close their own `resolved` ticket, and cannot perform any transition at all. Every transition is a staff action.

Letting a customer close a ticket would put the final SLA record in the hands of the party the promise was made to, and it would create audit entries whose actor is external. Confirmation that work is complete is expressed by the customer through a public comment, which is recorded but changes no state.

**Resolves FE-00/Q3** — closure is **manual**, performed by an `admin`. There is no timer that closes resolved tickets automatically. Automatic closure would write a state change with no actor, and every state change in this system has an accountable actor.

A self-transition is rejected with a conflict rather than accepted as a no-op, because a client repeating a request must be able to tell that nothing happened.

### Guards (BE-STATE-GUARDS)

| Transition | Precondition |
|---|---|
| `open` → `in_progress` | The ticket must have an assigned agent |
| `in_progress` → `resolved` | None beyond legality and permission |
| `resolved` → `closed` | None beyond legality and permission |

Requiring an assignee before work may begin is what makes the dispatcher step meaningful. Without it, a ticket could sit in `in_progress` with nobody accountable, which is exactly the failure this project exists to prevent.

### Effects (BE-EFFECTS)

Every transition, inside **one** database transaction:

| Transition | Effects |
|---|---|
| Creation | `status` = `open`; `created_at` set; priority scored by spec 06; `sla_deadline` computed; audit `ticket_created` |
| → `in_progress` | `status` updated; `first_response_at` set if null; audit `status_changed` |
| → `resolved` | `status` updated; `resolved_at` set; `sla_breached` finalised by spec 06; audit `status_changed` |
| → `closed` | `status` updated; `closed_at` set; audit `status_changed` plus the closure audit entry from spec 14 |

`first_response_at` is set only if currently null, so a ticket that somehow re-entered `in_progress` would not overwrite the true first response. The field is defensive by design even though the transition table forbids the case.

**Satisfies FE-06/BR-6** — the transition endpoint rejects any transition not in the table, and any transition the caller is not permitted to perform, with distinguishable error codes: `illegal_transition` and `forbidden` respectively.

**Satisfies FE-06/BR-10** — a rejected transition returns the ticket's **current** server-side status in the error details, so the client resynchronises without a second request.

### Concurrency

A transition reads the ticket with a row lock, re-checks legality against the locked row, then writes. Without the lock, two concurrent resolutions could both read `in_progress` and both write, producing two audit entries for one real change.

If the locked row's status is no longer the one the request assumed, the transition is rejected as a conflict carrying the actual current status.

---

## Rules and Invariants

**R1** — The transition table is data, not scattered conditionals. It is defined once and consulted by the service.

**R2** — Legality is checked before permission.

**R3** — A transition and its audit entry are written in one transaction. Neither can exist alone.

**R4** — `closed` is terminal. No code path writes a status onto a closed ticket.

**R5** — Timestamps are set by the transition, never accepted from the client.

**R6** — A transition never bypasses the service layer. No route or script writes `status` directly.

**R7** — Every transition takes a row lock before validating.

---

## Failure Modes

| Situation | Required behaviour |
|---|---|
| Transition not in the table | 409 `illegal_transition`, with the current status in details |
| Transition legal but not permitted | 403 `forbidden` |
| `open` → `in_progress` with no assignee | 409 with a message naming the precondition |
| Two concurrent identical transitions | One succeeds; the second receives 409 with the current status |
| Transition to the same status | 409, never a silent success |
| Audit write fails | The entire transaction rolls back; the status does not change |
| Transition attempted on a `closed` ticket | 409 `illegal_transition` |
| Client sends `resolved_at` in the body | Field absent from the schema; ignored |

---

## Acceptance Criteria

1. Exactly three transitions are legal after creation, and every other pair is rejected.
2. `closed` is terminal, verified by a test attempting every target status from `closed`.
12. A `customer` receives a permission failure on every transition, for every legal and illegal pair.
3. A ticket cannot enter `in_progress` without an assigned agent.
4. Illegal and forbidden transitions return distinguishable error codes.
5. A rejected transition returns the ticket's actual current status in the error details.
6. Every successful transition writes exactly one audit entry, in the same transaction.
7. A failed audit write rolls back the status change.
8. Two concurrent transitions produce exactly one state change and one audit entry.
9. A self-transition is rejected with a conflict.
10. No timestamp on a transition is ever taken from the request body.
11. The transition table exists as a single data structure, not as scattered conditionals.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Should `resolved` → `in_progress` exist for a premature resolution? | No in this scope; the linear path stays absolute | This file, if revisited |
| Q2 | Does reassignment while `in_progress` require returning to `open`? | No; assignment changes independently of status | `10-ASSIGNMENT.md` |
