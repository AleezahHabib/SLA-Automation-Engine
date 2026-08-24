# 06 — SLA: Triage, Deadlines, Breach and Compliance

**Status:** Draft
**Owns:** BE-TRIAGE, BE-DEADLINE, BE-BREACH-DEF, BE-COMPLIANCE
**Satisfies:** FE-06/BR-2, FE-07/BR-1, FE-07/BR-2, FE-07/BR-3, FE-07/BR-4, FE-10/BR-7
**Resolves:** FE-00/Q4, FE-03/Q3, FE-06/Q3, FE-07/Q3, FE-10/Q1

---

## Owns

| ID | Scope |
|---|---|
| BE-TRIAGE | The deterministic priority scoring rule applied at creation. |
| BE-DEADLINE | How `sla_deadline` is computed and when it may be recomputed. |
| BE-BREACH-DEF | The single definition of a breach used by every part of the system. |
| BE-COMPLIANCE | How compliance is calculated for reporting. |

This is the definitional heart of the project. Every other spec that mentions a deadline, a breach, or compliance defers to this file.

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| Detecting breaches on a schedule and writing the flag | BE-WORKER-LOOP, BE-BREACH-EVENT — spec 13 |
| Aggregating compliance over a window | BE-AGG-SUMMARY — spec 15 |
| Which statuses exist and how they change | BE-TRANSITIONS — spec 05 |
| Who may override priority | BE-PERMISSIONS — spec 04 |
| Displaying a countdown or an at-risk state | `frontend/specs/07-SLA-COUNTDOWN.md` |

**Definition versus detection.** This spec defines what a breach *is*. Spec 13 is the process that *notices* one. Spec 15 *counts* them. Three specs, one definition, stated here.

---

## Depends On

- BE-ENTITIES, BE-ENUMS — spec 01
- BE-TRANSITIONS — spec 05, for the resolution moment

---

## Contract

### Priority scoring (BE-TRIAGE)

**Satisfies FE-06/BR-2** — priority is assigned by the backend at creation. The creation schema contains no priority field, so a client cannot supply one; a submitted value is not rejected, it simply does not exist in the contract.

Scoring is a first-match-wins ordered rule list evaluated against the ticket subject and description:

| Order | Rule | Result |
|---|---|---|
| 1 | Matches a term in the critical term set | `critical` |
| 2 | Matches a term in the high term set | `high` |
| 3 | Matches a term in the low term set | `low` |
| 4 | No match | `medium` |

The term sets are versioned data in the codebase, not values scattered through logic. Matching is case-insensitive on word boundaries, so "outage" matches but "outages" is handled by including both forms rather than by substring matching, which would make "brownouts" match "out".

**Determinism is a requirement, not a preference.** The same input must always produce the same priority, this year and next, so a historical compliance figure can be explained and defended. That rules out any model-based classification writing the field. A language model may be used to *suggest* a priority to a human, but a deterministic rule is what writes it, per invariant I1 in `00-OVERVIEW.md`.

The rule version applied is recorded in the audit entry at creation, so a past scoring decision can be reproduced even after the term sets change.

### Deadline computation (BE-DEADLINE)

| Priority | SLA window |
|---|---|
| `critical` | 2 hours |
| `high` | 8 hours |
| `medium` | 24 hours |
| `low` | 72 hours |

`sla_deadline` = `created_at` + the window for the assigned priority.

The window is **calendar time, not business hours.** A critical ticket raised at 23:00 is due at 01:00. Business-hour arithmetic requires a working-calendar model, holidays, and a timezone per customer; none of that exists in this scope, and pretending otherwise would produce deadlines that quietly disagree with the contract they claim to represent. This is recorded as Q1.

**Satisfies FE-07/BR-1 and FE-07/BR-2** — `sla_deadline` and `created_at` are both stored and both returned in every ticket representation, so any consumer can derive the total window and the remaining time without knowing the table above.

`sla_deadline` is stored, not computed on read. If the durations change next year, tickets created under the old promise keep the deadline they were actually given.

### Priority override

**Resolves FE-00/Q4 and FE-06/Q3** — an `admin` may override priority after creation. An `agent` may not, at any point.

An override recomputes `sla_deadline` from the **original** `created_at`, never from the moment of the override. Recomputing from "now" would let a ticket escape an imminent breach by being downgraded, turning the priority field into a way to erase an SLA failure.

The override writes a `priority_overridden` audit entry carrying the old value, the new value, and the actor. A recomputation that moves the deadline into the past marks the ticket breached immediately.

### Breach definition (BE-BREACH-DEF)

> A ticket is **breached** when it reaches `resolved` later than its `sla_deadline`, or when the present moment is past its `sla_deadline` and it has not yet reached `resolved`.

**Resolves FE-10/Q1** — resolution time is measured to `resolved`, not to `closed`. The promise is to fix the problem; closure is administrative housekeeping that may happen days later and is not something a customer experiences.

Consequences of the definition, stated so no other spec has to infer them:

- A `closed` ticket's breach status is whatever it was at resolution. Closure never changes it.
- Once `sla_breached` is true it is never cleared. A missed promise stays missed.
- `sla_breached` is authoritative. **Satisfies FE-07/BR-3** — it is returned in every ticket representation, and no consumer computes breach status for any purpose other than live display.

**Resolves FE-03/Q3** — a ticket that was breached and has since been resolved does **not** appear in the current-state "Breached" count on the admin dashboard. That tile answers "what is on fire right now", and a resolved ticket is not on fire. It is counted in the historical compliance figures owned by spec 15. Two different questions, two different numbers, both correct.

**Satisfies FE-07/BR-4** — for a resolved ticket, the response carries `resolved_at` and `sla_breached`, so a completed ticket can be shown as met or missed rather than as a running timer.

**Resolves FE-07/Q3** — the backend exposes **no** at-risk flag. At-risk is a presentation threshold that a viewer may want to tune, it changes nothing about system state, and putting it in the payload would create a second place where SLA semantics live. The frontend derives it from `created_at` and `sla_deadline`, both of which it already has.

### Compliance calculation (BE-COMPLIANCE)

**Satisfies FE-10/BR-7** — reported compliance is computed from this same definition, by the same service used to enforce it. Reporting never re-implements the rule.

For a window, over tickets created in that window:

```
met      = resolved_at is not null AND resolved_at <= sla_deadline
missed   = resolved_at is not null AND resolved_at >  sla_deadline
          OR (resolved_at is null AND now > sla_deadline)
compliance = met / (met + missed)
```

Tickets neither resolved nor past their deadline are excluded from both numerator and denominator. Counting a ticket still comfortably within its window as a failure would make compliance depend on when the report was run.

---

## Rules and Invariants

**R1** — Priority is written only by triage at creation or by an `admin` override. No other path writes it.

**R2** — Triage is deterministic and replayable. No model output writes the priority field.

**R3** — `sla_deadline` is always derived from `created_at`, never from the current time.

**R4** — `sla_breached`, once true, is never set false.

**R5** — The breach definition exists in one service function. Every consumer calls it.

**R6** — Reporting compliance and enforced compliance use the same code path.

**R7** — At-risk does not exist server-side, in any payload, table, or query.

---

## Failure Modes

| Situation | Required behaviour |
|---|---|
| Ticket created with a client-supplied priority | Field absent from the schema; scoring proceeds normally |
| Override moves the deadline into the past | Ticket is marked breached immediately, and the audit records why |
| Term sets change after a ticket exists | Existing priorities and deadlines are untouched; only new tickets score differently |
| A ticket is resolved exactly at its deadline | Met, not missed; the comparison is inclusive at the boundary |
| Clock skew between application and database | All comparisons use database time, so a single clock governs |
| A ticket has a null deadline | Impossible by constraint; if encountered it is a data defect, logged and excluded from compliance |
| Resolution timestamp earlier than creation | Rejected as a data integrity error, never stored |

---

## Acceptance Criteria

1. The ticket creation schema contains no priority field.
2. Triage produces identical output for identical input across runs and processes.
3. No model or non-deterministic component writes the priority field.
4. `sla_deadline` equals `created_at` plus exactly the documented window for its priority.
5. A priority override recomputes the deadline from `created_at`, never from the override moment.
6. An override that places the deadline in the past marks the ticket breached immediately.
7. `sla_breached` is never reset to false by any code path.
8. Resolution exactly at the deadline counts as met.
9. Compliance reporting calls the same function that enforcement uses.
10. No payload, column, or query anywhere contains an at-risk concept.
11. A breached ticket that is later resolved is excluded from current-state breach counts and included in historical compliance.
12. The triage rule version is recorded in the creation audit entry.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Should SLA windows respect business hours and holidays? | No; calendar time only in this scope | This file, if revisited |
| Q2 | Should a first-response SLA exist separately from resolution? | No; `first_response_at` is captured but not enforced | This file, if revisited |
| Q3 | Should breaching notify anyone? | Recorded in the audit log only; no notification channel in this scope | `13-SLA-WORKER.md` |
