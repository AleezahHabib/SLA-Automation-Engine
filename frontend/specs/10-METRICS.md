# 10 — Operational Metrics and Reporting

**Status:** Draft
**Owns:** CAP-MET-FILTERS, CAP-MET-KPI, CAP-MET-CHARTS, CAP-MET-TABLE
**Routes:** `/admin/metrics`

---

## Owns

| ID | Scope |
|---|---|
| CAP-MET-FILTERS | The reporting period and scope controls, and how that state is encoded. |
| CAP-MET-KPI | The headline stat tiles for the selected period. |
| CAP-MET-CHARTS | Every chart on this page: which form each metric takes and how each is encoded. |
| CAP-MET-TABLE | The aggregate breakdown table, whose rows are groups rather than tickets. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| Current-state tiles on either dashboard | CAP-AGENT-SUMMARY — spec 02, CAP-ADMIN-SUMMARY — spec 03 |
| The definition of a breach | `backend/specs/06-SLA.md` |
| The on-track, at-risk, breached display rule | CAP-SLA-VISUAL — spec 07 |
| Any table whose rows are individual tickets | CAP-TLIST-TABLE — spec 05 |
| Colour ramps, the chart palette, and status colours | CAP-DS-TOKENS, CAP-DS-STATUS-COLOR — spec 12 |
| Tile, table, and control primitives | CAP-DS-PRIMITIVES — spec 12 |

**The line against specs 02 and 03, restated because it is the one that will be violated:** every number on this page is an aggregate over a **chosen period**. Every number on a dashboard describes **now**. "Currently breached" belongs to spec 03. "Breaches in the last 30 days" belongs here. They are different queries with different meanings and must never be presented as the same figure.

---

## Consumes

- CAP-AUTH-GUARD — spec 01, for the `admin` role gate
- CAP-API-QUERY, CAP-API-ERRORS — spec 11
- CAP-DS-TOKENS, CAP-DS-STATUS-COLOR, CAP-DS-PRIMITIVES, CAP-DS-LAYOUT, CAP-DS-FEEDBACK — spec 12

---

## Backend Requirements

| # | Requirement |
|---|---|
| BR-1 | A metrics endpoint accepting a start and end timestamp and returning aggregates for that window, restricted to `admin`. |
| BR-2 | Aggregates required: tickets created, tickets resolved, tickets closed, count meeting their deadline, count missing it, and median and 90th-percentile time to resolution. |
| BR-3 | A breakdown by priority for the same window: created, resolved, met, missed, and median resolution time per priority. |
| BR-4 | A breakdown by agent for the same window: resolved count, met count, missed count, and median resolution time. |
| BR-5 | A time series over the window at a server-chosen granularity, returning per-bucket created, resolved, and missed counts, with the bucket size stated in the response. |
| BR-6 | All aggregation must happen in the database. The endpoint must never return raw tickets for the client to aggregate. |
| BR-7 | Compliance must be computed from the same rule the SLA service enforces, so a reported figure can never disagree with an enforced one. |
| BR-8 | The response must state the window it actually used, so the UI can display exactly what was measured rather than what was requested. |
| BR-9 | An empty window must return zeroes and empty series, never a 404. |

Candidate endpoints — to be confirmed, not assumed:

- `GET /api/v1/metrics/summary`
- `GET /api/v1/metrics/by-priority`
- `GET /api/v1/metrics/by-agent`
- `GET /api/v1/metrics/timeseries`

---

## Behaviour

### B1 — Filters (CAP-MET-FILTERS)

A period control offering last 7 days, last 30 days, last 90 days, and a custom range. Default is last 30 days. Selection lives in the URL query string so a report view is shareable and survives reload.

Filters sit in a single row above the content, and every region on the page responds to the same selection. There is no per-chart period control.

The heading states the window returned by BR-8, not the window requested, so the user always reads what was actually measured.

### B2 — Headline tiles (CAP-MET-KPI)

Five stat tiles. These are values, not charts — a single number does not become clearer by being drawn as one bar.

| Tile | Value |
|---|---|
| SLA compliance | Percentage of tickets resolved within their deadline in the window |
| Tickets created | Count in the window |
| Tickets resolved | Count in the window |
| Median resolution time | Median across resolved tickets in the window |
| Deadlines missed | Count resolved after their deadline, plus still-open past deadline |

SLA compliance is the page's lead figure and is rendered larger than the rest, since it is the single number the whole system exists to move.

Each tile may show a comparison against the immediately preceding window of equal length. A comparison is labelled as a change, never presented as if it were part of the current window.

### B3 — Chart forms (CAP-MET-CHARTS)

Form is chosen from the data's job, before any colour decision.

| Metric | Job | Form | Colour job |
|---|---|---|---|
| Compliance over time | Trend, one series | Line | Single hue; no legend, the title names it |
| Volume over time: created vs resolved | Two distinct series over time | Multi-line | Categorical, fixed order, both direct-labelled |
| Met vs missed, per priority | Part-to-whole within an ordered scale | Horizontal stacked bar | Diverging pair with a neutral midpoint |
| Ticket volume by priority | Compare magnitude across an ordered scale | Horizontal bar | Sequential, one hue, darker is more |
| Resolution time by priority | Compare magnitude | Horizontal bar | Sequential, one hue |

Rules that hold for every chart on this page, without exception:

- **Never two y-axes.** Two measures of different scale become two charts or are indexed to a common base.
- **Categorical hues are assigned in fixed order and never cycled.** Colour follows the entity, so changing a filter never repaints the surviving series.
- **Sequential means one hue, light to dark. Diverging means two hues with a neutral grey midpoint.** No rainbow ramps, and never a hue at a diverging midpoint.
- **Status colours are reserved** for state and are never reused as a series colour.
- **Text uses ink tokens, never a series colour.** Identity is carried by the mark beside the label.
- **Two or more series always carry a legend**, and four or fewer are also direct-labelled, so identity never depends on colour alone.
- **Priority is an ordered scale**, so it takes a sequential ramp, not four unrelated categorical hues.
- The palette must pass the colour-vision separation check defined by CAP-DS-TOKENS before any chart ships. This is verified, not judged by eye.

Every chart carries a hover layer by default: a crosshair with a tooltip on line charts, and a per-mark tooltip elsewhere.

Dark mode uses steps chosen from the same ramps against the dark surface. It is never an automatic inversion of the light palette.

### B4 — Breakdown table (CAP-MET-TABLE)

One row per agent, with resolved count, met, missed, compliance percentage, and median resolution time. Sortable by any numeric column, defaulting to compliance ascending so the weakest result is visible first.

A second view of the same table groups by priority instead of by agent.

This table exists partly for accessibility: it is the non-visual reading of the same data the charts present, so no figure on the page is available only as a picture.

It is not spec 05's table. Its rows are aggregates, it has no ticket link, no filters, and no pagination.

---

## States and Edge Cases

| Situation | Required behaviour |
|---|---|
| No tickets in the window | Charts show an explicit empty state; tiles show zero, not a dash |
| Custom range with start after end | Control corrects the order rather than issuing the request |
| Range longer than the retention or data history | Response window from BR-8 is shown, and the difference is stated |
| One region's request fails | Only that region shows a retry; the rest of the page renders |
| A single data point in a time series | Rendered as a point, not a line of length zero |
| More than eight agents in the breakdown | The table holds all of them; charts never gain extra hues to match |
| Median undefined because nothing resolved | Shown as "No resolutions", never as zero |
| Reduced-motion preference set | Charts render without entry animation |
| Narrow viewport | Charts scroll inside their own container; the page never scrolls sideways |
| An `agent` reaches this route | Redirected by CAP-AUTH-GUARD before any request is made |

---

## Acceptance Criteria

1. Every figure on this page is an aggregate over the selected window, and no figure describes the present moment.
2. The selected period is fully reconstructable from the URL.
3. The heading states the window the backend reported, not the one requested.
4. No chart on this page has two y-axes.
5. Priority is encoded with a sequential ramp, never with unrelated categorical hues.
6. No chart relies on colour alone: every chart with two or more series has a legend, and four or fewer are also direct-labelled.
7. Status colours never appear as a series colour.
8. The categorical palette passes the colour-vision separation check before shipping, verified by running the check rather than by inspection.
9. Every chart has an equivalent readable representation in the breakdown table.
10. Dark mode palettes are chosen against the dark surface, not derived by inverting the light values.
11. A single number is never rendered as a one-bar chart.
12. Aggregation is never performed client-side.
13. An empty window renders zeroes and empty states, never an error.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Is time-to-resolution measured to `resolved` or to `closed`? | To `resolved`, since that is when the SLA promise is satisfied | `backend/specs/06-SLA.md` |
| Q2 | Do still-open tickets past deadline count against compliance in the window? | Yes, counted as missed | `backend/specs/15-METRICS.md` |
| Q3 | Is the time-series bucket size chosen by the server or requested by the client? | Chosen by the server and stated in the response | `backend/specs/15-METRICS.md` |
| Q4 | Should reports be exportable to CSV? | Not in this scope | This file, if revisited |
