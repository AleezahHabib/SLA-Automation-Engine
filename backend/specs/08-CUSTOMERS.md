# 08 — Customers

**Status:** Draft
**Owns:** BE-CUST-CRUD, BE-CUST-SEARCH, BE-CUST-BINDING, BE-CUST-ACCOUNT-LINK
**Satisfies:** FE-04/BR-1, FE-04/BR-2, FE-04/BR-3, FE-04/BR-4, FE-04/BR-7, FE-04/BR-9
**Resolves:** FE-04/Q2

---

## Owns

| ID | Scope |
|---|---|
| BE-CUST-CRUD | Creating, reading, and updating customer records. |
| BE-CUST-SEARCH | Listing and searching customers, including the intake selection list. |
| BE-CUST-BINDING | The rule binding a ticket to exactly one customer. |
| BE-CUST-ACCOUNT-LINK | The rule binding a login to a Customer record. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| Who may write a customer | BE-PERMISSIONS — spec 04 |
| Field definitions | BE-ENTITIES — spec 01 |
| Ticket queries filtered by customer | BE-TICKET-QUERY — spec 09 |
| Authentication of any kind | BE-LOGIN — spec 07 |

**This spec manages records; spec 07 creates logins.** A Customer record holds no password and no role — those live on the linked `User`. This spec owns the *linking rule*; the registration flow that invokes it belongs to spec 07.

A Customer record with no linked login remains completely valid. It is what an admin creates to log a ticket raised by phone, and it is what a later self-registration attaches to.

---

## Depends On

- BE-ENTITIES — spec 01
- BE-PERMISSIONS — spec 04
- BE-CONSTRAINTS — spec 02

---

## Contract

### Listing and search (BE-CUST-SEARCH)

**Satisfies FE-04/BR-1** — the list endpoint is paginated using the envelope from spec 03 and supports a free-text query matched case-insensitively against `name` and `email`.

Search is a prefix and substring match at this scale, not a full-text index, per spec 02 Q2. A customer table of this size does not justify the operational weight of a text search configuration.

Archived customers are excluded by default and included only on explicit request, so an archived record cannot be selected for a new ticket by accident.

A second endpoint returns a lightweight selection list for ticket intake: id, name, and email only, searchable, capped. It exists because intake needs to *choose* a customer, and shipping the full management payload for that would be wasteful and would expose fields an agent has no reason to receive.

### Read, create, update (BE-CUST-CRUD)

**Satisfies FE-04/BR-2** — a single-customer endpoint returns the profile fields defined in spec 01.

**Satisfies FE-04/BR-3** — creation rejects a duplicate email with 422 and `email` named in `details`, never a 500. The unique constraint is caught in the service and translated, rather than allowed to escape as a database error.

**Satisfies FE-04/BR-4** — update is partial: only fields present in the request body are changed. An absent field is left alone; a field explicitly set to null is cleared where the column is nullable.

Email is normalised to lower case, matching the user rule in spec 07, so a customer cannot be created twice under different casing.

**Satisfies FE-04/BR-7** — there is **no delete endpoint**. Customers are archived by setting `is_archived`. A customer is referenced by tickets forever, and those tickets are the compliance record; deleting the customer would either orphan them or cascade away history that a contractual SLA report depends on.

**Resolves FE-04/Q2** — no optimistic concurrency control. Last write wins. Two admins editing the same customer within seconds is not a realistic contention pattern here, and an `If-Match` mechanism would add a header contract, a version column, and a conflict path to every client for a race that does not occur. Recorded so the omission is a decision rather than an oversight.

### Account linking (BE-CUST-ACCOUNT-LINK)

A Customer record carries **at most one** linked login, enforced by a unique constraint on the linking column in spec 02.

Linking happens only through customer self-registration in spec 07, matched by email. There is no admin endpoint that attaches a login to a record, because that would mean an admin setting someone else's password.

**Satisfies FE-04/BR-9** — a Customer record's `has_portal_access` indicator is derived from whether a linked user exists, computed in the query rather than stored as a writable field. A stored flag would eventually disagree with reality, and the disagreement would be invisible.

Archiving a customer that has a linked login also deactivates that login, in the same transaction. Leaving an active login attached to an archived record would let someone sign in to an account the organisation considers closed.

### Binding (BE-CUST-BINDING)

Every ticket references exactly one customer, required at creation and never null.

The reference is by `customer_id` with a restricting foreign key. A creation request naming a customer that does not exist is rejected as a 422 with the field named, not as a foreign-key error surfaced as a 500.

`customer_id` is immutable after creation. Moving a ticket to a different customer would silently rewrite that customer's history and their compliance figures. If a ticket was raised against the wrong customer, it is resolved and a new one is raised — the same reasoning that makes `closed` terminal in spec 05.

---

## Rules and Invariants

**R1** — Customer records never carry a credential, a role, or an authentication path.

**R2** — Email is stored and compared in lower case, uniquely.

**R3** — Customers are archived, never deleted, and no delete endpoint exists.

**R4** — Archived customers are excluded from selection lists.

**R5** — `customer_id` on a ticket is immutable after creation.

**R6** — A uniqueness violation is translated to a field-level validation error in the service.

**R7** — Customer record writes are `admin`-only, enforced in the service as well as the route.

**R8** — A Customer record carries at most one linked login.

**R9** — Archiving a customer deactivates its linked login in the same transaction.

**R10** — `has_portal_access` is always derived, never stored as an independently writable field.

---

## Failure Modes

| Situation | Required behaviour |
|---|---|
| Duplicate email on create | 422 with `email` in details |
| Duplicate email on update | 422 with `email` in details |
| Customer id not found | 404 |
| Agent attempts create or update | 403 |
| Attempt to delete via any route | No such route exists |
| Ticket created against an archived customer | 422 explaining the customer is archived |
| Ticket created against a non-existent customer | 422 naming `customer_id` |
| Attempt to change `customer_id` on an existing ticket | Field absent from the update schema; ignored |
| Search term with pattern metacharacters | Escaped and treated literally |

---

## Acceptance Criteria

1. No endpoint in this spec creates anything that can authenticate.
2. No delete endpoint exists for customers, on any path.
3. Duplicate emails are impossible regardless of casing.
4. A duplicate email returns 422 with the field named, never a 500.
5. Partial update changes only the fields present in the request.
6. Archived customers do not appear in the intake selection list.
7. A ticket cannot be created against a non-existent or archived customer.
8. `customer_id` cannot be changed after ticket creation through any code path.
9. An agent receives 403 on every customer write endpoint.
10. Search input is escaped and cannot alter the query pattern.
11. The selection list returns only id, name, and email.
12. A Customer record cannot acquire a second linked login.
13. Archiving a customer with a linked login deactivates that login in the same transaction.
14. A `customer` caller receives 403 on every endpoint in this spec.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Can an archived customer be restored? | Yes, by clearing the flag through the update endpoint | This file, if revisited |
| Q2 | Is there a merge path for duplicate customers created before the constraint? | Not in this scope | This file, if revisited |
