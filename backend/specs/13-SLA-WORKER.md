# 13 — SLA Monitor Worker

**Status:** Draft
**Owns:** BE-WORKER-LOOP, BE-CLAIM, BE-BREACH-EVENT, BE-LIFESPAN
**Satisfies:** FE-02/BR-3, FE-03/BR-5, FE-05/BR-6
**Resolves:** None

---

## Owns

| ID | Scope |
|---|---|
| BE-WORKER-LOOP | The asyncio loop: cadence, batching, and lifecycle. |
| BE-CLAIM | Concurrency-safe selection of tickets to process. |
| BE-BREACH-EVENT | Recording a breach and its audit entry. |
| BE-LIFESPAN | Starting and stopping the worker with the application. |

This is the component that makes the system active rather than passive. Without it, a breach is discovered by an angry customer.

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| What a breach is | BE-BREACH-DEF — spec 06 |
| Deadline computation | BE-DEADLINE — spec 06 |
| Counting breaches for reports | BE-AGG-SUMMARY — spec 15 |
| The audit entry schema | BE-AUDIT-SCHEMA — spec 14 |
| Displaying a countdown | `frontend/specs/07-SLA-COUNTDOWN.md` |

**The worker detects; it does not define.** The predicate it evaluates comes from spec 06. If the definition changes, this spec does not.

---

## Depends On

- BE-BREACH-DEF — spec 06
- BE-INDEXES — spec 02, specifically the composite index on status and deadline
- BE-AUDIT-WRITE — spec 14
- BE-ENV — spec 16, for the cadence setting

---

## Contract

### The loop (BE-WORKER-LOOP)

An asyncio task started with the application, waking on a fixed interval, defaulting to 60 seconds and set by environment.

Sixty seconds is chosen against the tightest SLA window: a `critical` ticket has 120 minutes, so a one-minute detection lag is under one percent of the promise. A shorter interval would add database load for precision nobody can act on.

Each cycle: open a session, claim a batch of due tickets, mark each breached with its audit entry, commit, close, sleep. Batch size is bounded so one cycle cannot hold a long transaction.

If more tickets are due than the batch size, the remainder is handled by the next cycle. The ordering is by deadline ascending, so the longest-overdue is always handled first.

The loop never crashes the application. An exception in one cycle is logged with context, the session is rolled back and closed, and the next cycle proceeds. A worker that dies silently is worse than one that logs and retries.

### The claim query (BE-CLAIM)

Due tickets are those whose `sla_deadline` is in the past, whose `sla_breached` is false, and whose status is `open` or `in_progress`.

Rows are selected with a row lock that **skips already-locked rows**. This is what makes the worker safe under more than one running instance: two workers claim disjoint sets rather than blocking on each other or double-processing.

This matters because the deployment runs the worker inside the API process. Scaling the API to two instances silently creates two workers. Rather than forbidding that, the claim query is written so it is harmless.

The query is served by the composite index on status and deadline from spec 02, so the scan stays cheap as the ticket table grows.

Database time is used for the comparison, never application time, so all instances agree on "now" regardless of host clock drift.

### Breach recording (BE-BREACH-EVENT)

For each claimed ticket, in one transaction: set `sla_breached` true, set `sla_breached_at` to the database time, write an `sla_breached` audit entry with a null actor.

A null actor is meaningful: it identifies the system rather than a person, and it is the only place in the audit log where actor is null.

The operation is idempotent. A ticket already flagged is excluded by the claim predicate, so a restart mid-cycle or an overlapping run cannot double-record.

`sla_breached_at` records when the breach was **detected**, not when it occurred. The moment it occurred is exactly `sla_deadline`, already stored, so recording detection time preserves both facts.

**Satisfies FE-02/BR-3, FE-03/BR-5, FE-05/BR-6** — because this worker maintains `sla_breached` as an authoritative stored column, every ticket representation carries it without any consumer computing it. Dashboards and lists read a fact rather than evaluating a rule, and the frontend's live countdown is presentation over the same stored values.

A ticket resolved after its deadline without the worker having reached it is marked breached at resolution by spec 06, so a breach is never missed because of the detection lag.

### Lifecycle (BE-LIFESPAN)

Started in the application lifespan handler and cancelled on shutdown, awaiting the in-flight cycle so a transaction is never abandoned mid-commit.

It runs inside the API process rather than as a separate service. This is the deliberate consequence of the two-service deployment: introducing a third service for a task that wakes once a minute would double the platform footprint for no gain. The claim query is what makes it safe.

The worker can be disabled by environment, which is required so the test suite and any local run do not perform background writes.

---

## Rules and Invariants

**R1** — The breach predicate is imported from spec 06's service, never reimplemented here.

**R2** — Claiming always uses a lock that skips locked rows.

**R3** — All time comparisons use database time.

**R4** — Marking a breach and writing its audit entry are one transaction.

**R5** — The operation is idempotent; an already-flagged ticket is never reprocessed.

**R6** — An exception in a cycle never terminates the loop or the application.

**R7** — Each cycle uses its own session and holds no transaction across a sleep.

**R8** — The worker is disabled by default under test.

---

## Failure Modes

| Situation | Required behaviour |
|---|---|
| Database unavailable for a cycle | Logged, cycle skipped, loop continues, next cycle retries |
| Two instances running | Each claims a disjoint set; no ticket is processed twice |
| Application restarts mid-cycle | Uncommitted work rolls back; the next cycle reclaims those tickets |
| A very large backlog | Processed in bounded batches over successive cycles, oldest first |
| A ticket is resolved between claim and update | Its status is re-checked inside the transaction; if resolved, spec 06 governs and the worker skips it |
| The audit write fails | Whole transaction rolls back; the flag is not set |
| Host clock drift | Irrelevant; database time governs |
| Worker disabled by configuration | Application starts normally and serves requests with no background writes |

---

## Acceptance Criteria

1. The worker starts with the application and stops cleanly on shutdown without abandoning a transaction.
2. The claim query uses a lock that skips locked rows, verified by a concurrent-worker test.
3. Two simultaneous workers never both flag the same ticket.
4. Marking a breach and writing its audit entry occur in one transaction, and a failed audit rolls back the flag.
5. An already-breached ticket is never reprocessed.
6. An exception in one cycle does not stop the loop or affect request serving.
7. All comparisons use database time, verified by a test with a skewed application clock.
8. `sla_breached_at` records detection time while `sla_deadline` remains the moment of breach.
9. The breach predicate is the same function spec 06 defines, verified by reference rather than by duplication.
10. The worker can be disabled by configuration, and the test suite runs with it disabled.
11. A backlog larger than the batch size is drained over successive cycles, oldest first.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Should an approaching deadline produce any server-side event, not only a breach? | No; at-risk is presentation-only per spec 06 | This file, if revisited |
| Q2 | Should breaches notify anyone, resolving spec 06 Q3? | No notification channel in this scope; the audit entry is the record | This file, if revisited |
| Q3 | Should the worker move to a separate service if the API scales? | Not needed; the claim query makes multiple workers safe | `16-DEPLOYMENT.md` |
