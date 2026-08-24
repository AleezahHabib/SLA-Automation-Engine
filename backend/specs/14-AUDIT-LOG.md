# 14 — Audit Log

**Status:** Draft
**Owns:** BE-AUDIT-SCHEMA, BE-AUDIT-WRITE, BE-CLOSURE-AUDIT
**Satisfies:** FE-06/BR-9
**Resolves:** None

---

## Owns

| ID | Scope |
|---|---|
| BE-AUDIT-SCHEMA | The shape of an audit entry and the action vocabulary. |
| BE-AUDIT-WRITE | Which operations write an entry, and the transactional guarantee. |
| BE-CLOSURE-AUDIT | The closure record that completes a ticket's lifecycle. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| Human-written notes | BE-COMMENT-CREATE — spec 11 |
| The operations being audited | Specs 05, 06, 09, 10, 12, 13 |
| Who may read the audit trail | BE-PERMISSIONS — spec 04 |

**Audit entries are written by the system, comments by people.** The audit log answers "what happened and who did it". Comments answer "what did someone want to say". Different tables, different endpoints, different immutability reasons.

---

## Depends On

- BE-ENTITIES, BE-ENUMS — spec 01
- BE-PERMISSIONS — spec 04

---

## Contract

### Entry shape (BE-AUDIT-SCHEMA)

Fields are defined in spec 01. The action vocabulary:

| Action | Written by | `from_value` / `to_value` |
|---|---|---|
| `ticket_created` | Spec 09 | null / `open`, with the triage rule version in `detail` |
| `status_changed` | Spec 05 | Previous status / new status |
| `assigned` | Spec 10 | Previous assignee name or null / new assignee name |
| `unassigned` | Spec 10 | Previous assignee name / null |
| `priority_overridden` | Spec 06 | Previous priority / new priority, with the recomputed deadline in `detail` |
| `sla_breached` | Spec 13 | null / null, with the deadline and detection time in `detail` |
| `comment_added` | Spec 11 | null / null, with the comment id in `detail` |
| `attachment_added` | Spec 12 | null / null, with the filename in `detail` |

Values are stored as human-readable strings, not ids. An audit log is read by a person months later, and a row saying "Priya Nair to Sam Okafor" is legible where two UUIDs are not. The actor id remains a foreign key for accountability; the value pair is a snapshot for reading.

That snapshot is deliberately denormalised: it records what was true at the time, and it must not change if a user is later renamed. An audit trail that rewrites itself when a name changes is not an audit trail.

`actor_id` is null only for entries written by the SLA worker. Every other entry has a person.

### When entries are written (BE-AUDIT-WRITE)

**Satisfies FE-06/BR-9** — every transition and every assignment writes an audit entry **in the same transaction** as the change itself. There is no path where a state change succeeds and its audit entry does not, and none where an entry exists without its change.

This is the strongest guarantee in the system, and it is why audit writing is a service call inside the transaction rather than an event, a background task, or a listener. Anything asynchronous would introduce a window where the two disagree.

Entries are append-only. There is no update path, no delete path, and no soft-delete flag, mirroring comments in spec 11.

### Closure record (BE-CLOSURE-AUDIT)

Closing a ticket writes a `status_changed` entry like any transition, plus a closure summary in `detail` capturing the ticket's final SLA outcome: the deadline, the resolution time, and whether the promise was met.

This exists because closure is the moment the record becomes permanent. Reconstructing the outcome later requires joining several timestamps and re-evaluating the breach rule; capturing it once at closure makes the ticket's ending readable from its own history.

### Reading the trail

Exposed through the endpoint in spec 03, restricted to `admin`, paginated, ordered oldest first so a ticket's history reads chronologically.

Agents do not read the audit trail, and customers never see it under any circumstance. It exists for accountability and dispute resolution, which is an operational-owner concern; agents see the comment thread instead, and customers see only public comments.

The audit trail records internal actions — who reassigned what, when a breach was detected — and exposing it externally would leak operational detail the portal deliberately withholds.

---

## Rules and Invariants

**R1** — Every state change writes exactly one audit entry, in the same transaction.

**R2** — No update or delete path exists for audit entries.

**R3** — Audit writing is never asynchronous, queued, or deferred.

**R4** — Value snapshots are human-readable strings, frozen at write time.

**R5** — `actor_id` is null only for worker-written entries.

**R6** — A failed audit write rolls back the change it was recording.

**R7** — No audit entry contains a credential, a token, a password, or a file's contents.

**R8** — No audit data is exposed to a `customer` on any endpoint, in any payload.

---

## Failure Modes

| Situation | Required behaviour |
|---|---|
| Audit write fails | Whole transaction rolls back; the state change does not occur |
| A user is renamed after an entry exists | The snapshot is unchanged; only the foreign key still resolves to the renamed user |
| A user is deleted | Prevented by the restricting foreign key in spec 02 |
| Ticket is deleted | Impossible; tickets are not deletable |
| An agent requests the audit trail | 403 |
| Two concurrent changes to one ticket | Serialised by the row lock in spec 05; two entries in the correct order |
| An operation is added without auditing | Caught by the invariant test in spec 17 |

---

## Acceptance Criteria

1. Every transition, assignment, unassignment, priority override, and breach produces exactly one audit entry.
2. Every entry is written in the same transaction as the change it records.
3. A forced audit failure rolls back the state change, verified by a test.
4. No update or delete path for audit entries exists in the application.
5. Value snapshots are strings and do not change when a user is renamed.
6. `actor_id` is null only for `sla_breached` entries.
7. Closing a ticket writes a closure summary containing the deadline, resolution time, and SLA outcome.
8. The audit endpoint is `admin`-only and returns 403 for an agent and for a `customer`.
11. No payload served to a `customer` anywhere in the API contains audit data.
9. Audit entries are ordered oldest first and paginated.
10. No audit entry contains a credential, token, or file content.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Should reading the audit trail itself be audited? | No; read auditing needs a retention policy this scope does not have | This file, if revisited |
| Q2 | Is there a retention period after which entries are purged? | No; entries are permanent in this scope | This file, if revisited |
