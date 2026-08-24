# 02 — Agent Dashboard

**Status:** Draft
**Owns:** CAP-AGENT-SUMMARY, CAP-AGENT-QUEUE, CAP-AGENT-ATTENTION
**Routes:** `/agent/dashboard`

---

## Owns

| ID | Scope |
|---|---|
| CAP-AGENT-SUMMARY | The snapshot tiles at the top of the agent dashboard: which tiles exist, what each counts, and their order. |
| CAP-AGENT-QUEUE | The "My tickets" panel: which preset query feeds it, how many rows it shows, and its empty state. |
| CAP-AGENT-ATTENTION | The "Needs attention" panel: which tickets qualify, how they are ordered, and its empty state. |

This spec owns **page composition for one role**. It is a arrangement of panels, not a set of new components.

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| Ticket table columns, row rendering, sorting, filtering | CAP-TLIST-TABLE, CAP-TLIST-FILTER, CAP-TLIST-SORT — spec 05 |
| The SLA badge shown in each row | CAP-SLA-BADGE — spec 07 |
| The rule that decides on-track, at-risk, or breached | CAP-SLA-VISUAL — spec 07 |
| Historical aggregates over a date range | CAP-MET-KPI, CAP-MET-CHARTS — spec 10 |
| The tile component itself, sidebar, and page chrome | CAP-DS-PRIMITIVES, CAP-DS-LAYOUT — spec 12 |
| Anything an admin sees | CAP-ADMIN-SUMMARY — spec 03 |

**The line against spec 10:** this dashboard shows the *current state of work in front of one agent right now*. Spec 10 shows *what happened over a chosen period*. If a number requires a date range to be meaningful, it belongs to spec 10, not here.

---

## Consumes

- CAP-AUTH-GUARD — spec 01, for the `agent` role gate on this route
- CAP-TLIST-TABLE — spec 05, rendered in compact mode inside both panels
- CAP-SLA-BADGE, CAP-SLA-VISUAL — spec 07
- CAP-API-QUERY — spec 11, for fetching and revalidation
- CAP-DS-PRIMITIVES, CAP-DS-LAYOUT, CAP-DS-FEEDBACK, CAP-DS-STATUS-COLOR — spec 12

---

## Backend Requirements

| # | Requirement |
|---|---|
| BR-1 | The ticket list endpoint must accept a filter restricting results to tickets assigned to the requesting user, without the client sending its own user id. |
| BR-2 | The ticket list endpoint must accept a status filter and a result limit, so a panel can request a small preset slice. |
| BR-3 | Every ticket in a list response must carry its `sla_deadline` as an absolute timestamp and an authoritative breach indicator computed server-side. |
| BR-4 | A counts endpoint scoped to the requesting agent must return the number of assigned tickets by status and the number currently breached, in one request. |
| BR-5 | Counts must be computed by the database, not by returning all rows for the client to count. |
| BR-6 | List responses must be ordered deterministically so a panel showing the first N rows is stable between requests. |

Candidate endpoints — to be confirmed against `backend/specs/03-API-CONTRACT.md`, not assumed:

- `GET /api/v1/tickets`
- `GET /api/v1/tickets/summary`

---

## Behaviour

### B1 — Page shape

Three regions, stacked, in this order: summary tiles, "Needs attention", "My tickets". The attention panel sits above the queue because a breached ticket outranks an ordinary one.

### B2 — Summary tiles (CAP-AGENT-SUMMARY)

Four tiles, all scoped to the signed-in agent, all describing the present moment.

| Tile | Counts |
|---|---|
| Open | Assigned tickets with status `open` |
| In Progress | Assigned tickets with status `in_progress` |
| Breached | Assigned tickets the backend reports as past their deadline |
| At Risk | Assigned tickets not breached but inside the at-risk threshold |

The Breached count comes from the backend and is authoritative. The At Risk count is derived on the client from the same ticket set using the rule owned by CAP-SLA-VISUAL, because at-risk is a presentation state that does not exist in the backend contract.

Tiles are not clickable in this scope. See Q1.

### B3 — Needs attention (CAP-AGENT-ATTENTION)

Assigned tickets that are breached or at risk, and not yet `resolved` or `closed`. Ordered by `sla_deadline` ascending, so the most urgent is first. Shows at most 10 rows with a link to the filtered ticket list owned by spec 05.

A resolved ticket never appears here even if its deadline passed, because the work is done and the record belongs in reporting, not in a work queue.

### B4 — My tickets (CAP-AGENT-QUEUE)

Assigned tickets with status `open` or `in_progress`, ordered by `sla_deadline` ascending, at most 10 rows, with a link to the full list.

Tickets already surfaced in "Needs attention" still appear here. Duplication is intentional: the queue is the complete picture of current work, the attention panel is a filter over it.

### B5 — Data freshness

Both panels and the tiles revalidate on window focus and on an interval defined by CAP-API-QUERY. This page never polls on its own schedule.

The live per-second countdown inside a row is driven by CAP-SLA-TIMER from the timestamp already held in the client. A ticket crossing its deadline changes appearance immediately without a refetch, but the authoritative breach count updates only on the next revalidation.

---

## States and Edge Cases

| Situation | Required behaviour |
|---|---|
| Agent has no assigned tickets | Both panels show an empty state; tiles show zero rather than being hidden |
| Summary request fails but list requests succeed | Tiles show an inline error, panels still render |
| A list request fails | That panel shows a retry affordance; the rest of the page still renders |
| Backend cold start | Skeletons in all three regions, never a blank page |
| A ticket is reassigned away while the page is open | It disappears on the next revalidation; no client-side removal |
| Deadline passes while the page is open | The row's SLA presentation changes immediately; the Breached tile updates on revalidation |
| An `admin` reaches this route | Redirected by CAP-AUTH-GUARD before any request is made |
| More than 10 qualifying tickets | Panel shows 10 and a link carrying the same filter into spec 05's list |

---

## Acceptance Criteria

1. Every number on this page is scoped to the signed-in agent; no tile or panel shows another agent's work.
2. No number on this page requires a date range to interpret.
3. The Breached tile's value comes from the backend response, never from a client-side comparison.
4. The At Risk tile is computed only through CAP-SLA-VISUAL and nowhere else in this spec.
5. Panels render with the table component owned by spec 05; this spec introduces no table markup of its own.
6. "Needs attention" is ordered by deadline ascending and excludes `resolved` and `closed` tickets.
7. Each panel's "view all" link lands on spec 05's list with the same filter already applied.
8. A failure in any one request degrades only its own region.
9. Every status and priority string rendered matches the frozen vocabulary in `00-OVERVIEW.md` Section 3.
10. The page issues no more than three requests on initial load.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Should summary tiles be clickable shortcuts into a filtered list? | Not in this scope; the panel links cover it | This file, if revisited |
| Q2 | Does the summary endpoint return counts for all four statuses or only the two open ones? | All four, so the shape is reusable by spec 03 | `backend/specs/15-METRICS.md` |
