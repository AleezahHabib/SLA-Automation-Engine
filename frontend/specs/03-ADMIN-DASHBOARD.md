# 03 — Admin Dashboard

**Status:** Draft
**Owns:** CAP-ADMIN-SUMMARY, CAP-ADMIN-UNASSIGNED, CAP-ADMIN-AGENT-LOAD
**Routes:** `/admin/dashboard`

---

## Owns

| ID | Scope |
|---|---|
| CAP-ADMIN-SUMMARY | The organisation-wide snapshot tiles: which tiles exist, what each counts, and their order. |
| CAP-ADMIN-UNASSIGNED | The unassigned ticket queue panel: which tickets qualify, ordering, and empty state. |
| CAP-ADMIN-AGENT-LOAD | The per-agent workload panel: what is shown per agent and how it is ordered. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| The control that actually assigns a ticket to an agent | CAP-TDET-ASSIGN — spec 06 |
| Ticket table columns, filters, sorting, pagination | CAP-TLIST-TABLE, CAP-TLIST-FILTER — spec 05 |
| SLA presentation and badges | CAP-SLA-VISUAL, CAP-SLA-BADGE — spec 07 |
| Historical reporting over a date range | CAP-MET-KPI, CAP-MET-CHARTS, CAP-MET-TABLE — spec 10 |
| Customer records | CAP-CUST-LIST — spec 04 |
| Page chrome and tile component | CAP-DS-LAYOUT, CAP-DS-PRIMITIVES — spec 12 |
| The agent's own dashboard | CAP-AGENT-SUMMARY — spec 02 |

**The line against spec 06:** this page *lists* tickets that need a dispatcher's attention and links to them. The act of assigning happens on the ticket page. There is no assignment control on this dashboard. See Q1.

**The line against spec 10:** every number here describes the present moment. Anything needing a period selector belongs to spec 10.

---

## Consumes

- CAP-AUTH-GUARD — spec 01, for the `admin` role gate
- CAP-TLIST-TABLE — spec 05, compact mode
- CAP-SLA-BADGE, CAP-SLA-VISUAL — spec 07
- CAP-API-QUERY — spec 11
- CAP-DS-PRIMITIVES, CAP-DS-LAYOUT, CAP-DS-FEEDBACK, CAP-DS-STATUS-COLOR — spec 12

---

## Backend Requirements

| # | Requirement |
|---|---|
| BR-1 | The ticket list endpoint must accept a filter for tickets with no assigned agent. |
| BR-2 | An organisation-wide counts endpoint must return ticket counts by status, counts by priority, and the number currently breached, in one request, restricted to `admin`. |
| BR-3 | An endpoint must return, per active agent, the number of tickets currently assigned to them by status and how many of those are breached. |
| BR-4 | Agent workload must be computed by the database. The client must never fetch all tickets and group them. |
| BR-5 | Every ticket in a list response must carry `sla_deadline` and an authoritative breach indicator. |
| BR-6 | All three endpoints must reject a non-`admin` caller with a 403, independently of any UI guard. |

Candidate endpoints — to be confirmed, not assumed:

- `GET /api/v1/tickets`
- `GET /api/v1/tickets/summary`
- `GET /api/v1/agents/workload`

---

## Behaviour

### B1 — Page shape

Three regions in order: summary tiles, "Unassigned", "Agent workload". Unassigned sits first because an unassigned ticket is burning its SLA with nobody working it, which is the single most actionable state in the system.

### B2 — Summary tiles (CAP-ADMIN-SUMMARY)

Five tiles, organisation-wide, all describing the present moment.

| Tile | Counts |
|---|---|
| Unassigned | Tickets with no assigned agent, not `resolved` or `closed` |
| Open | All tickets with status `open` |
| In Progress | All tickets with status `in_progress` |
| Breached | All tickets the backend reports as past deadline and not yet `resolved` |
| At Risk | Tickets not breached but inside the at-risk threshold |

As in spec 02, Breached is authoritative from the backend; At Risk is derived through CAP-SLA-VISUAL.

### B3 — Unassigned queue (CAP-ADMIN-UNASSIGNED)

Tickets with no assigned agent and status `open`. Ordered by `sla_deadline` ascending. At most 10 rows, with a link into spec 05's list carrying the same filter.

Each row links to the ticket page, where the assignment control owned by spec 06 lives. This panel renders no assignment affordance of its own.

### B4 — Agent workload (CAP-ADMIN-AGENT-LOAD)

One row per active agent showing: agent name, count of assigned `open`, count of assigned `in_progress`, and count of assigned breached tickets. Ordered by breached count descending, then by total active tickets descending, so the agent in most trouble appears first.

This panel is a plain table of counts, not the ticket table. It is the one table in this spec that spec 05 does not own, because its rows are agents, not tickets.

An agent with zero active tickets still appears, showing zeros. Hiding idle agents would hide exactly the capacity a dispatcher is looking for.

### B5 — Data freshness

Identical policy to spec 02 B5: revalidation on focus and on the interval defined by CAP-API-QUERY, with per-second countdown motion driven locally by CAP-SLA-TIMER.

---

## States and Edge Cases

| Situation | Required behaviour |
|---|---|
| No unassigned tickets | Panel shows a positive empty state, not an error |
| No agents exist yet | Workload panel shows an empty state explaining that no agents are registered |
| One of the three requests fails | Only that region degrades; the other two still render |
| An agent is deactivated while the page is open | They disappear on the next revalidation |
| A ticket is assigned by another admin while the page is open | It leaves the unassigned panel on the next revalidation, not immediately |
| More than 10 unassigned tickets | Show 10 and link to the filtered list in spec 05 |
| An `agent` reaches this route | Redirected by CAP-AUTH-GUARD before any request is made |
| Workload table with many agents | Table scrolls within its own container; the page never scrolls sideways |

---

## Acceptance Criteria

1. Every number on this page describes the current moment and needs no date range to interpret.
2. No assignment or reassignment control appears anywhere on this page.
3. The unassigned panel excludes tickets that already have an agent, and excludes `resolved` and `closed`.
4. Agent workload is ordered with the most-breached agent first.
5. An agent with no active tickets is listed with zeros rather than omitted.
6. Ticket rows use the table component owned by spec 05; only the agent workload table is defined here.
7. The Breached tile's value comes from the backend, never from a client-side comparison.
8. Every panel link lands on spec 05's list with the same filter already applied.
9. A failure in any one request degrades only its own region.
10. The page issues no more than three requests on initial load.
11. Every status and priority string matches the frozen vocabulary in `00-OVERVIEW.md` Section 3.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Should the unassigned panel offer inline assignment without navigating to the ticket? | No; a single assignment control on the ticket page keeps CAP-TDET-ASSIGN the only owner | This file, if revisited |
| Q2 | Does "active agent" mean any user with role `agent`, or is there an enabled flag? | Any user with role `agent` | `backend/specs/01-DOMAIN-MODEL.md` |
| Q3 | Should breached-and-resolved tickets appear in the Breached tile? | No; they belong to reporting in spec 10 | `backend/specs/06-SLA.md` |
