# 07 — SLA Countdown and Presentation

**Status:** Draft
**Owns:** CAP-SLA-TIMER, CAP-SLA-VISUAL, CAP-SLA-BADGE
**Routes:** None

---

## Owns

| ID | Scope |
|---|---|
| CAP-SLA-TIMER | The live countdown component, its tick cadence, and its formatting. |
| CAP-SLA-VISUAL | The single rule that maps a ticket to `on_track`, `at_risk`, or `breached`, and the presentation of each. |
| CAP-SLA-BADGE | The compact SLA badge used in dense views such as tables and dashboard panels. |

This spec is the **only** place in the frontend where a deadline is compared against the current time. Every other spec consumes these components.

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| The SLA duration for each priority, and the deadline itself | `backend/specs/06-SLA.md` |
| Whether a ticket is officially breached, for any purpose beyond display | `backend/specs/06-SLA.md` |
| Detecting breaches and recording them | `backend/specs/13-SLA-WORKER.md` |
| Where the countdown appears on the ticket page | CAP-TDET-VIEW — spec 06 |
| The column the badge sits in | CAP-TLIST-TABLE — spec 05 |
| Breach counts on dashboards | CAP-AGENT-SUMMARY — spec 02, CAP-ADMIN-SUMMARY — spec 03 |
| Historical breach reporting | CAP-MET-KPI, CAP-MET-CHARTS — spec 10 |
| The colour values used for each state | CAP-DS-STATUS-COLOR — spec 12 |

**Authority split, stated once:** the backend decides whether a breach *happened*. This spec decides what the user *sees* between now and the deadline. When the two disagree, the backend wins and the display corrects itself on the next revalidation.

---

## Consumes

- CAP-DS-TOKENS, CAP-DS-STATUS-COLOR, CAP-DS-PRIMITIVES — spec 12

This spec makes no network requests. It is pure presentation over data its consumers already hold.

---

## Backend Requirements

| # | Requirement |
|---|---|
| BR-1 | Every ticket representation must include `sla_deadline` as an absolute, timezone-unambiguous timestamp. |
| BR-2 | Every ticket representation must include the ticket's creation timestamp, so the total SLA window can be derived without knowing the priority-to-duration mapping. |
| BR-3 | Every ticket representation must include an authoritative breach indicator computed server-side. |
| BR-4 | For a ticket that reached `resolved`, the response must include the resolution timestamp and whether it met its deadline, so a completed ticket can be shown as met or missed rather than as a running timer. |
| BR-5 | Timestamps must be serialised in a single consistent format across every endpoint. Mixed formats would make the countdown wrong in ways that are hard to detect. |

This spec requires no endpoints of its own.

---

## Behaviour

### B1 — The derivation rule (CAP-SLA-VISUAL)

Given `created_at`, `sla_deadline`, the backend breach indicator, and the ticket's status, exactly one state is produced.

```
window     = sla_deadline - created_at
remaining  = sla_deadline - now

if status is resolved or closed  -> completed presentation (see B4)
if backend reports breached      -> breached
if remaining <= 0                -> breached
if remaining <= window * 0.25    -> at_risk
otherwise                        -> on_track
```

The at-risk threshold is **25% of the ticket's own window**, not a fixed number of minutes. This makes it proportionate: a `critical` ticket becomes at-risk with 30 minutes left, a `low` ticket with 18 hours left. Both represent the same fraction of the promise consumed.

The backend indicator is checked before the local comparison so that a server-recorded breach is never contradicted by clock skew on the client.

This rule is implemented once in `frontend/features/sla/`. No other file in the application may compare a deadline to the current time.

### B2 — Tick cadence (CAP-SLA-TIMER)

| Remaining time | Update interval | Format |
|---|---|---|
| More than 24 hours | 60 seconds | `3d 4h` |
| 1 to 24 hours | 60 seconds | `4h 12m` |
| Under 1 hour | 1 second | `08:31` |
| Past deadline | 60 seconds | `Overdue by 2h 14m` |

The one-second cadence exists only in the final hour, where it communicates urgency. Ticking every second on a list of 25 low-priority tickets would waste render cycles for no informational gain.

All timers on a page share a single interval source so a table of 25 rows schedules one timer, not 25.

Timers pause when the document is hidden and resynchronise from the timestamp on becoming visible again. A tab restored after an hour shows the correct value immediately, without replaying missed ticks.

### B3 — Presentation states

| State | Meaning conveyed | Treatment |
|---|---|---|
| `on_track` | Comfortable | Neutral text, no emphasis |
| `at_risk` | Action needed soon | Warning treatment, medium emphasis |
| `breached` | Promise already broken | Error treatment, strongest emphasis |

Colour values come from CAP-DS-STATUS-COLOR. State is never conveyed by colour alone: each state also carries distinct text, so the information survives for colour-blind users and in monochrome print.

### B4 — Completed tickets

A `resolved` or `closed` ticket has no future deadline, so it shows no running timer. It shows whether the deadline was met, using the resolution data from BR-4: either the time to resolution, or how far past the deadline it landed.

Showing a live countdown on a finished ticket would imply work is still outstanding.

### B5 — Badge variant (CAP-SLA-BADGE)

A single-line, fixed-width badge combining the state treatment with the shortest sensible time format. Fixed width prevents columns from reflowing every second in the final hour.

The badge takes the same inputs as the full timer and applies the same rule from B1. There are not two implementations.

---

## States and Edge Cases

| Situation | Required behaviour |
|---|---|
| `sla_deadline` is absent or unparseable | Render a neutral "No deadline" state; never render `NaN` or a fallback of zero |
| Client clock is ahead of the server | Backend breach indicator takes precedence; local comparison cannot un-breach a ticket |
| Client clock is behind the server | A ticket the backend reports breached is shown breached regardless of local arithmetic |
| Deadline crosses while the tab is hidden | Correct state shown immediately on becoming visible; no missed-tick replay |
| Window computes as zero or negative | Treat as breached and record it under Q2 rather than dividing by zero |
| Ticket resolved after its deadline | Completed presentation showing the overrun, not a live breached timer |
| Very long overdue durations | Formatted in days and hours; never an unbounded seconds count |
| Reduced-motion preference set | No animated transitions between states; the change is instant |

---

## Acceptance Criteria

1. The comparison between a deadline and the current time appears in exactly one module in the entire frontend.
2. The at-risk threshold is 25% of each ticket's own window, not a fixed duration.
3. A backend breach indicator always wins over the client-side comparison.
4. A page rendering 25 rows schedules one shared interval, not one per row.
5. Timers stop while the document is hidden and show correct values immediately on return.
6. A `resolved` or `closed` ticket never shows a running countdown.
7. Every state is distinguishable without colour.
8. A missing or invalid deadline renders a neutral state, never `NaN`, `Invalid Date`, or a zeroed timer.
9. The badge and the full timer produce the same state for the same inputs in every case.
10. The badge does not change width as the countdown ticks.
11. This spec issues no network requests.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Should the at-risk threshold be configurable per deployment? | No; fixed at 25% for this scope | This file, if revisited |
| Q2 | Should a zero or negative window be surfaced as a data error to the user? | No; treat as breached and log to the console only | This file, if revisited |
| Q3 | Does the backend expose a distinct at-risk flag, making the client rule redundant? | No; at-risk stays presentation-only | `backend/specs/06-SLA.md` |
