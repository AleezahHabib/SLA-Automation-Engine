# 17 — Backend Testing

**Status:** Draft
**Owns:** BE-TEST-UNIT, BE-TEST-INTEGRATION, BE-TEST-INVARIANTS, BE-TEST-FIXTURES
**Satisfies:** FE-13/BR-3
**Resolves:** None

---

## Owns

| ID | Scope |
|---|---|
| BE-TEST-UNIT | Unit test strategy for pure logic. |
| BE-TEST-INTEGRATION | Endpoint tests against a real database. |
| BE-TEST-INVARIANTS | The suite proving the project's transactional and authorisation invariants. |
| BE-TEST-FIXTURES | Fixtures, factories, and the seeded demonstration dataset. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| What each feature must do | Every spec's Acceptance Criteria |
| Frontend testing | `frontend/specs/13-TESTING.md` |
| Deployment configuration | BE-ENV — spec 16 |

**Tests assert specifications; they never become one.** Every test traces to a numbered acceptance criterion. A behaviour asserted by a test and described by no spec is a defect in the specification set.

---

## Depends On

- Every specification's Acceptance Criteria section
- BE-ENV — spec 16, for the test configuration

---

## Contract

### Layers

| Layer | Covers | Database |
|---|---|---|
| Unit | Pure functions with branches | None |
| Integration | Endpoints through the full stack | Real PostgreSQL, transaction-rolled-back per test |
| Invariant | The guarantees the project exists to make | Real PostgreSQL, some with real concurrency |

Integration tests run against a real PostgreSQL, not a substitute. This project's core guarantees are row locks, transactional rollback, unique constraints, and concurrent claiming — none of which an in-memory database reproduces. A test suite that passed against a substitute would be proving nothing about the properties that matter.

**No containers.** The suite connects to the development database service from spec 16, using a dedicated test schema created and dropped by the suite. This follows the project's no-Docker constraint.

The SLA worker is disabled during tests except where a test starts it deliberately, so background writes cannot make assertions non-deterministic.

### Unit coverage

| Target | Owning spec |
|---|---|
| Triage scoring, including determinism across runs | 06 |
| Deadline computation for all four priorities | 06 |
| The breach predicate at and around every boundary | 06 |
| The transition table, every legal and illegal pair | 05 |
| Permission matrix evaluation for every action and role | 04 |
| Connection string scheme rewrite | 16 |
| Reference formatting | 09 |

Clock-dependent logic receives an injected time. No test reads the real clock.

### Integration coverage

Every endpoint in spec 03's inventory is exercised for its success path, its permission failure, and its principal validation failure. A route absent from this suite is treated as a route that does not exist.

The permission suite is generated from a table mirroring spec 04's matrix, resolving that spec's Q2, so adding an endpoint without a permission test fails the build rather than passing silently.

### Invariant suite (BE-TEST-INVARIANTS)

These prove the project's defining guarantees. They are named individually because they are the reason the system is trustworthy.

| # | Invariant | Source |
|---|---|---|
| 1 | A transition and its audit entry commit together; a forced audit failure rolls back the status | 05, 14 |
| 2 | Two concurrent identical transitions produce one state change and one audit entry | 05 |
| 3 | `closed` is terminal from every target status | 05 |
| 4 | A ticket cannot enter `in_progress` without an assignee | 05 |
| 5 | A client-supplied priority at creation is ignored, and triage governs | 06, 09 |
| 6 | A priority override recomputes the deadline from `created_at`, never from now | 06 |
| 7 | `sla_breached` is never reset to false by any code path | 06 |
| 8 | Two concurrent SLA workers never both flag the same ticket | 13 |
| 9 | An agent cannot assign, close, override priority, or write a customer, through any path | 04 |
| 10 | An agent's list scoping is applied in SQL, and `total` never counts invisible rows | 04, 09 |
| 11 | Pagination over tied deadlines never repeats or skips a row | 09 |
| 12 | A comment or attachment cannot be added to a `closed` ticket | 11, 12 |
| 13 | No update or delete path exists for comments, attachments, or audit entries | 11, 12, 14 |
| 14 | Attachment metadata and bytes are always consistent | 12 |
| 15 | `password_hash` appears in no response, verified across the whole OpenAPI document | 01, 07 |
| 16 | Every non-public route declares a guard, verified by walking the route table | 04 |
| 17 | Every enum in the OpenAPI schema matches the frozen vocabulary | 01, 03 |
| 18 | Every timestamp in every response is ISO-8601 with an explicit offset | 03 |
| 19 | A `customer` can never read a ticket, comment, or attachment belonging to another customer, through any endpoint or filter | 04, 09 |
| 20 | No payload served to a `customer` contains an internal comment or an internal attachment | 11, 12 |
| 21 | No payload served to a `customer` contains an assigned agent, audit data, or a breach aggregate | 03, 14, 15 |
| 22 | A `customer` cannot perform any transition, assignment, or priority override | 04, 05 |
| 23 | A `customer` cannot create an internal comment or an internal attachment | 11, 12 |
| 24 | Customer registration links to an existing unlinked record by email rather than creating a duplicate | 07, 08 |
| 25 | A staff user never has a `customer_id` and a `customer` user always does | 01, 02 |

Invariants 1, 2, and 8 require real concurrency: parallel sessions against the same rows, not mocked contention.

Invariants 19 through 21 are **tenant isolation** and deserve the heaviest scrutiny in the suite. A failure there is a data breach rather than a bug: one client sees another client's tickets, or a customer reads an internal note. They are asserted against the **serialised payload**, not the rendered output, because a field that reaches the client and is hidden by the UI has still left the server.

### Fixtures and seed data (BE-TEST-FIXTURES)

Factories produce valid entities from overridable defaults. A test states only the fields it cares about.

**Satisfies FE-13/BR-3** — a seed script creates a documented demonstration dataset: one `admin`, three `agent` users, **two `customer` users linked to two different customer records**, further customers with no login, and tickets spread across all four statuses and all four priorities, including some already breached and some approaching their deadline. Comments and attachments exist in both internal and public forms. Credentials for all three roles are documented in the project README.

Two customer logins on two different records is the minimum that makes tenant isolation demonstrable: a reviewer can sign in as each and confirm neither sees the other's tickets.

The seed exists so a reviewer can open the deployed application and see a system in a realistic state within seconds, rather than an empty database. It runs only as an explicit command, never automatically on deploy, and never against production without intent.

Seeded tickets are created through the service layer, so they receive genuine triage and genuine deadlines. Inserting rows directly would produce demonstration data that contradicts the system's own rules.

No fixture or seed record contains a real name, email address, or company.

---

## Rules and Invariants

**R1** — Every test traces to a numbered acceptance criterion.

**R2** — No test reads the real clock.

**R3** — Integration tests run against real PostgreSQL.

**R4** — No container is required to run the suite.

**R5** — The SLA worker is disabled unless a test starts it deliberately.

**R6** — Each test is isolated; no test depends on another's residue.

**R7** — Concurrency invariants use real parallel sessions.

**R8** — No fixture contains real personal data.

---

## Failure Modes

| Situation | Required behaviour |
|---|---|
| Test database unreachable | Suite fails immediately with a clear message, not with hundreds of confusing errors |
| A test leaves data behind | Prevented by per-test transaction rollback |
| A flaky timing assertion | Fixed by injecting time, never by adding a sleep |
| A new endpoint added without a permission test | Generated permission suite fails |
| A new route added without a guard | Invariant 16 fails |
| Enum drift between backend and frontend | Invariant 17 fails |
| Seed run against production by accident | Guarded by an explicit confirmation flag |

---

## Acceptance Criteria

1. The suite runs with no container, using the development database service.
2. Integration tests execute against real PostgreSQL, not a substitute.
3. All twenty-five invariants in this file have a corresponding test.
4. Invariants 1, 2, and 8 use real parallel sessions.
14. Invariants 19 through 21 assert against the serialised response payload, not the rendered output.
15. The seed dataset contains two customer logins on two different customer records, plus internal and public comments and attachments.
5. Every endpoint in spec 03's inventory has a success, a permission-failure, and a validation-failure test.
6. The permission suite is generated from a table mirroring spec 04's matrix.
7. No test reads the real clock.
8. The SLA worker is disabled by default in the suite.
9. Each test rolls back, leaving no residue.
10. The seed script creates the documented dataset through the service layer, and its credentials appear in the README.
11. The seed script cannot run against production without an explicit confirmation.
12. No fixture or seed record contains real personal data.
13. Every test traces to a numbered acceptance criterion in some specification.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Is a coverage threshold enforced numerically? | No; the invariant suite and traceability are the standard | This file, if revisited |
| Q2 | Are performance or load tests in scope? | No | This file, if revisited |
| Q3 | Does the suite run in CI, given no workflow folder exists? | Locally in this scope; adding CI requires only a workflow file | This file, if revisited |
