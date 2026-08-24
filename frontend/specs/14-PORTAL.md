# 14 — Customer Portal

**Status:** Draft
**Owns:** CAP-PORT-COMPOSE, CAP-PORT-SUMMARY, CAP-PORT-QUEUE
**Routes:** `/portal/dashboard`

---

## Owns

| ID | Scope |
|---|---|
| CAP-PORT-COMPOSE | The portal route group, its shell, and the read-only posture that applies across it. |
| CAP-PORT-SUMMARY | The snapshot tiles on the portal dashboard: which exist and what each counts. |
| CAP-PORT-QUEUE | The customer's own open-ticket panel: which tickets qualify, ordering, and empty state. |

Like specs 02 and 03, this spec owns **page composition for one role**. It introduces no new table, tile, or ticket component.

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| The ticket table and its customer column set | CAP-TLIST-TABLE — spec 05 |
| The ticket page and the portal intake form | CAP-TDET-CREATE, CAP-TDET-VIEW — spec 06 |
| SLA presentation and countdown | CAP-SLA-TIMER, CAP-SLA-VISUAL, CAP-SLA-BADGE — spec 07 |
| Which comments a customer may see | CAP-CMT-VISIBILITY — spec 08 |
| Which attachments a customer may see | CAP-ATT-VISIBILITY — spec 09 |
| Customer registration and the role guard | CAP-AUTH-REGISTER, CAP-AUTH-GUARD — spec 01 |
| The shell, navigation, and primitives | CAP-DS-LAYOUT, CAP-DS-PRIMITIVES — spec 12 |
| Staff dashboards | CAP-AGENT-SUMMARY — spec 02, CAP-ADMIN-SUMMARY — spec 03 |
| Who may see what, as a rule | `backend/specs/04-RBAC.md` |

**This spec shows; it never decides.** Every restriction described here is already enforced server-side. The portal is a narrower view of the same API, not a second system with its own rules.

---

## Consumes

- CAP-AUTH-GUARD, CAP-AUTH-SESSION — spec 01, for the `customer` role gate and the linked customer name
- CAP-TLIST-TABLE — spec 05, customer variant, compact mode
- CAP-SLA-BADGE, CAP-SLA-VISUAL — spec 07
- CAP-API-QUERY — spec 11
- CAP-DS-PRIMITIVES, CAP-DS-LAYOUT, CAP-DS-FEEDBACK, CAP-DS-STATUS-COLOR — spec 12

---

## Backend Requirements

| # | Requirement |
|---|---|
| BR-1 | A summary counts endpoint must serve a `customer` caller with counts scoped to their linked customer record, using the same response shape staff receive, so one generated type covers all three roles. |
| BR-2 | The ticket list endpoint must scope a `customer` caller to their linked customer record from the session alone. It must ignore any customer filter such a caller sends, rather than honouring or rejecting it, so a portal client can never widen its own scope. |

Candidate endpoints — already defined in `backend/specs/03-API-CONTRACT.md`:

- `GET /api/v1/tickets/summary`
- `GET /api/v1/tickets`

---

## Behaviour

### B1 — Route group and posture (CAP-PORT-COMPOSE)

Everything under `/portal` is gated to the `customer` role by CAP-AUTH-GUARD. Staff are redirected out, exactly as a customer is redirected out of staff routes.

The portal is **read-mostly**. A customer can do three things: raise a ticket, add a public comment, and attach a customer-visible file. Everything else is observation. There is no status control, no assignment, no priority, and no agent name anywhere in the portal.

Withholding the agent's identity is deliberate. It prevents a customer from directing pressure at an individual, and it keeps reassignment an internal operational decision that carries no external explanation.

The shell shows the customer's own name and their linked company, taken from the current-user response per spec 01 BR-9, so the account a person is signed into is never ambiguous.

### B2 — Dashboard tiles (CAP-PORT-SUMMARY)

Three tiles, scoped to the signed-in customer, all describing the present moment.

| Tile | Counts |
|---|---|
| Open | Tickets with status `open` |
| In Progress | Tickets with status `in_progress` |
| Awaiting closure | Tickets with status `resolved` and not yet `closed` |

There is no breach tile and no at-risk tile. A customer is shown the SLA countdown on each individual ticket, which tells them what they need to know about their own case. A running total of missed promises is an internal performance measure, and surfacing it as a headline invites a conversation about aggregate performance that this portal is not built to have.

The response shape is the same one staff receive per BR-1; the portal simply renders three of its values.

### B3 — My tickets (CAP-PORT-QUEUE)

Tickets belonging to this customer with status `open` or `in_progress`, ordered by `sla_deadline` ascending, at most 10 rows, with a link to the full list on `/portal/tickets`.

Ordering by deadline matches every other list in the system, so a customer sees the same priority ordering the staff do.

The panel uses spec 05's table in compact mode with the customer column set. This spec defines the preset query and the row limit, nothing more.

A "Raise a ticket" action leads to `/portal/tickets/new`, owned by spec 06.

### B4 — Data freshness

Identical to specs 02 and 03: revalidation on focus and on the interval defined by CAP-API-QUERY, with per-second countdown motion driven locally by CAP-SLA-TIMER.

---

## States and Edge Cases

| Situation | Required behaviour |
|---|---|
| Customer has no tickets | Empty state whose primary action raises the first ticket |
| Summary request fails | Tiles show an inline error; the panel still renders |
| Panel request fails | Panel shows a retry; tiles still render |
| A ticket is resolved while the page is open | It moves to "Awaiting closure" on the next revalidation |
| A ticket is closed | It leaves both the panel and the active tiles |
| A deadline passes while the page is open | The row's SLA presentation changes immediately through spec 07 |
| Staff member reaches a `/portal` route | Redirected by CAP-AUTH-GUARD before any request is made |
| More than 10 active tickets | Panel shows 10 with a link to the full list |
| Customer record renamed by an admin | Reflected on the next current-user rehydration |

---

## Acceptance Criteria

1. Every `/portal` route is reachable only by a `customer`, and staff are redirected without an error.
2. No agent name appears anywhere in the portal, on any screen, in any state.
3. No status control, assignment control, or priority control exists anywhere in the portal.
4. Every figure on the portal dashboard is scoped to the signed-in customer's linked record.
5. No breach count or at-risk count appears on the portal dashboard.
6. The portal renders no table, tile, or ticket component of its own; all are consumed from specs 05, 06, 07, and 12.
7. Tiles use the same response shape staff receive, so no portal-specific generated type exists.
8. The queue panel is ordered by `sla_deadline` ascending, matching every other list in the system.
9. The panel's "view all" link lands on `/portal/tickets` with the same preset applied.
10. A failure in one region degrades only that region.
11. The portal dashboard issues no more than two requests on initial load.
12. Every status string rendered matches the frozen vocabulary in `00-OVERVIEW.md` Section 3.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | May a customer close their own `resolved` ticket, confirming the work is done? | No; closure stays `admin`-only so the audit record has one accountable owner | `backend/specs/05-STATE-MACHINE.md` |
| Q2 | Should the portal show a satisfaction prompt after closure? | Not in this scope | This file, if revisited |
| Q3 | Should several people from one company share one customer record? | Out of scope; each registration binds one login to one record, matched by email | This file, if revisited |
