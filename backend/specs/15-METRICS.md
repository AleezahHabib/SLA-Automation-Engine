# 15 — Metrics and Aggregation

**Status:** Draft
**Owns:** BE-AGG-SUMMARY, BE-AGG-PRIORITY, BE-AGG-AGENT, BE-TIMESERIES
**Satisfies:** FE-02/BR-4, FE-03/BR-2, FE-03/BR-3, FE-10/BR-1, FE-10/BR-2, FE-10/BR-3, FE-10/BR-4, FE-10/BR-5, FE-10/BR-8, FE-10/BR-9, FE-14/BR-1
**Resolves:** FE-02/Q2, FE-10/Q2, FE-10/Q3

---

## Owns

| ID | Scope |
|---|---|
| BE-AGG-SUMMARY | Current-state counts and windowed summary aggregates. |
| BE-AGG-PRIORITY | Breakdown by priority. |
| BE-AGG-AGENT | Per-agent workload and per-agent windowed performance. |
| BE-TIMESERIES | Time-bucketed series over a window. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| The compliance formula and breach definition | BE-COMPLIANCE, BE-BREACH-DEF — spec 06 |
| Maintaining the breach flag | BE-BREACH-EVENT — spec 13 |
| Ticket listing | BE-TICKET-QUERY — spec 09 |
| Chart forms and colour | `frontend/specs/10-METRICS.md` |

**Two different questions, both served here.** "What is happening now" powers dashboards. "What happened over a window" powers reporting. They are separate endpoints returning separate numbers, and a spec that conflates them produces a figure nobody can interpret.

---

## Depends On

- BE-COMPLIANCE, BE-BREACH-DEF — spec 06
- BE-INDEXES — spec 02
- BE-PERMISSIONS — spec 04

---

## Contract

### Current-state summary (BE-AGG-SUMMARY, present tense)

**Satisfies FE-02/BR-4** — an agent-scoped counts endpoint returns assigned ticket counts by status and the number currently breached, in one request. Scope comes from the session; the client sends no user id.

**Satisfies FE-03/BR-2** — the same endpoint returns organisation-wide counts for an `admin` caller: counts by status, counts by priority, unassigned count, and currently breached.

**Satisfies FE-14/BR-1** — the same counts endpoint serves a `customer` caller, scoped to their linked customer record. The response shape is identical across all three roles, so one generated type covers every caller and the portal simply renders three of its values.

A customer's counts exclude any breach figure. The field is **omitted from their payload**, per spec 03 R10, rather than sent as zero — a zero would be a false statement about their tickets. Individual SLA countdowns remain visible per ticket; what is withheld is the aggregate.

**Resolves FE-02/Q2** — counts are returned for **all four statuses**, not only the two active ones, so one response shape serves both the agent and admin dashboards. A response that differs by role would need two generated types for one concept.

"Currently breached" counts tickets with `sla_breached` true whose status is `open` or `in_progress`. A breached ticket that has since been resolved is excluded, per spec 06's resolution of FE-03/Q3.

**Satisfies FE-03/BR-3** — a workload endpoint returns, per active agent, assigned counts by status and how many of those are breached.

Every one of these is a single aggregate query using conditional counts, returning one row per group. None fetches ticket rows.

### Windowed reporting (past tense)

**Satisfies FE-10/BR-1** — a summary endpoint accepts a start and end timestamp and returns aggregates for tickets created in that window. `admin` only.

**Satisfies FE-10/BR-2** — returned: created, resolved, closed, met, missed, median time to resolution, and 90th-percentile time to resolution.

The 90th percentile accompanies the median because a median hides the tail, and the tail is where SLA failures live. A median of two hours with a 90th percentile of three days describes a very different operation than a median of two hours alone.

**Satisfies FE-10/BR-3** — a by-priority breakdown returns created, resolved, met, missed, and median resolution time per priority.

**Satisfies FE-10/BR-4** — a by-agent breakdown returns resolved count, met, missed, and median resolution time per agent.

**Resolves FE-10/Q2** — a ticket still open past its deadline **counts as missed** in the window it was created in. Excluding it would let an organisation improve its reported compliance by leaving tickets open, which is precisely the behaviour the metric exists to discourage.

**Satisfies FE-10/BR-5 and resolves FE-10/Q3** — a time series returns per-bucket created, resolved, and missed counts. The bucket size is **chosen by the server** from the window length and stated in the response: hourly up to 2 days, daily up to 90 days, weekly beyond. Letting the client choose would allow a request for hourly buckets over a year, producing nearly nine thousand points that no chart can render and no database should compute.

**Satisfies FE-10/BR-8** — every response states the window actually used. A requested range is clamped to the available data range, and the response reports the clamped values, so a heading can display what was measured rather than what was asked for.

**Satisfies FE-10/BR-9** — an empty window returns zeroes and empty series with a 200, never a 404. Absence of data is a valid answer to a valid question.

Compliance is computed by calling spec 06's function, never by reimplementing the rule here. A reported figure and an enforced figure cannot disagree, because they are the same code.

Medians and percentiles are computed in SQL. Every aggregate is a database query returning summary rows.

---

## Rules and Invariants

**R1** — Aggregation happens in SQL. No endpoint loads ticket rows to compute a figure.

**R2** — Compliance calls spec 06's function; the rule is never duplicated.

**R3** — Present-tense and past-tense endpoints are separate and never mixed in one response.

**R4** — Every windowed response states the window actually applied.

**R5** — Bucket granularity is chosen server-side.

**R6** — Every reporting endpoint is `admin`-only. The counts endpoint serves all three roles, scoped by session.

**R6a** — No reporting endpoint is reachable by a `customer`, and no breach aggregate appears in a customer payload.

**R7** — An empty result is a 200 with zeroes.

**R8** — No metrics endpoint accepts a user id; scope comes from the session or from an `admin` filter.

---

## Failure Modes

| Situation | Required behaviour |
|---|---|
| Start after end | 422 naming both fields |
| Window wider than available data | Clamped, with the applied window reported |
| No tickets in the window | 200 with zeroes and empty series |
| No resolutions in the window | Median reported as null, never as zero |
| Agent calls a reporting endpoint | 403 |
| Agent calls the counts endpoint | Allowed, scoped to their own tickets |
| Customer calls the counts endpoint | Allowed, scoped to their linked record, breach field omitted |
| Customer calls any reporting endpoint | 403 |
| Window spanning years | Weekly buckets; the response states the granularity |
| Division by zero in compliance | Denominator zero returns null compliance, not zero |
| A very large window | Bounded by bucket granularity; the query stays a single aggregate |

---

## Acceptance Criteria

1. No metrics endpoint returns or iterates ticket rows.
2. Compliance is computed by calling spec 06's function, verified by reference not duplication.
3. Present-tense counts and windowed aggregates are served by separate endpoints.
4. Counts are returned for all four statuses regardless of caller role.
5. A breached-then-resolved ticket is excluded from current breach counts and included in windowed missed counts.
6. A still-open overdue ticket counts as missed in its creation window.
7. Bucket granularity is chosen by the server and stated in every time-series response.
8. Every windowed response reports the window actually applied.
9. An empty window returns 200 with zeroes, never 404.
10. A null median is returned when nothing resolved, never zero.
11. Compliance with a zero denominator returns null, not zero.
12. Every reporting endpoint returns 403 for an agent and for a `customer`.
14. The counts endpoint serves all three roles with one response shape and one generated type.
15. A `customer` counts payload omits every breach aggregate rather than reporting zero.
13. Medians and percentiles are computed in SQL.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Should figures be cached, given aggregation cost? | Not in this scope; add caching when a query is measurably slow | This file, if revisited |
| Q2 | Is `first_response_at` reported, resolving spec 01 Q2? | Captured but not reported in this scope | This file, if revisited |
| Q3 | Should windows be aligned to a customer timezone rather than UTC? | UTC only | This file, if revisited |
