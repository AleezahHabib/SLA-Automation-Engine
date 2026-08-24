# 04 — Role-Based Access Control

**Status:** Draft
**Owns:** BE-ROLES, BE-PERMISSIONS, BE-JWT-CLAIMS, BE-GUARDS, BE-TENANT-ISOLATION
**Satisfies:** FE-03/BR-6, FE-04/BR-6, FE-06/BR-4, FE-06/BR-5, FE-11/BR-4
**Resolves:** FE-00/Q2, FE-04/Q1

---

## Owns

| ID | Scope |
|---|---|
| BE-ROLES | The role set and what each role represents. |
| BE-PERMISSIONS | The permission matrix: every action, every role, every scope condition. |
| BE-JWT-CLAIMS | The token claim structure. |
| BE-GUARDS | The dependency layer that enforces permissions on every request. |
| BE-TENANT-ISOLATION | The rule confining a `customer` caller to their own linked record, and how it is applied. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| Issuing and validating tokens | BE-TOKEN — spec 07 |
| Which transitions are legal in the first place | BE-TRANSITIONS — spec 05 |
| What each endpoint does | Specs 08–15 |
| The frontend's cosmetic route guards | `frontend/specs/01-AUTH-FLOW.md` |

**Legality and permission are different questions.** Spec 05 decides whether a transition is legal for the ticket's current state. This spec decides whether *this user* may perform it. Both must pass. Conflating them produces rules that cannot be reasoned about.

---

## Depends On

- BE-ENTITIES, BE-ENUMS — spec 01
- BE-ERRORS — spec 03, for 401 and 403 semantics

---

## Contract

### Roles (BE-ROLES)

| Role | Represents |
|---|---|
| `admin` | Operational owner. Dispatches work, manages customers, reads reporting, overrides priority. |
| `agent` | Support staff. Works tickets, primarily their own. |
| `customer` | External. Sees only their own linked customer record's tickets, through the portal. |

`admin` and `agent` are staff. `customer` is external, and the boundary between them is the most consequential one in the system.

"Dispatcher" is an activity `admin` performs, not a fourth role — introducing one would require a matrix column that duplicates `admin` almost entirely.

### Token claims (BE-JWT-CLAIMS)

| Claim | Contents |
|---|---|
| `sub` | User id |
| `role` | `admin`, `agent`, or `customer` |
| `customer_id` | Present only for a `customer` user |
| `email` | For logging and support |
| `iat`, `exp` | Issued-at and expiry |

The `role` claim exists so a client can choose a landing screen without an extra request. **It is a convenience, never an authority.** Every guard re-reads the user from the database and checks `is_active` on every request, so a token issued before a role change or a deactivation cannot outlive it.

### Permission matrix (BE-PERMISSIONS)

`own` means the ticket is assigned to the requesting user. `mine` means the ticket belongs to the caller's linked customer record.

| Action | `admin` | `agent` | `customer` |
|---|---|---|---|
| Register, login | public | public | public |
| Read own user | yes | yes | yes |
| List customers | yes | no | **no** |
| Create customer | yes | **no** | **no** |
| Update customer | yes | no | **no** |
| List selectable customers for intake | yes | yes | **no** |
| Create ticket | yes | yes | yes, bound to `mine` |
| List tickets — all | yes | no | **no** |
| List tickets — own and unassigned | yes | yes | no |
| List tickets — `mine` | yes | no | yes |
| Read a ticket | any | own or unassigned | `mine` |
| See the assigned agent | yes | yes | **no** |
| Transition `open` to `in_progress` | any | own | **no** |
| Transition `in_progress` to `resolved` | any | own | **no** |
| Transition `resolved` to `closed` | yes | **no** | **no** |
| Assign or reassign a ticket | yes | **no** | **no** |
| Clear an assignment | yes | no | **no** |
| Override priority | yes | **no** | **no** |
| Add an internal comment | any ticket | tickets they may read | **no** |
| Add a public comment | any ticket | tickets they may read | `mine` |
| Read internal comments | any ticket | tickets they may read | **no** |
| Read public comments | any ticket | tickets they may read | `mine` |
| Upload an internal attachment | any ticket | tickets they may read | **no** |
| Upload a customer-visible attachment | any ticket | tickets they may read | `mine` |
| Download an internal attachment | any ticket | tickets they may read | **no** |
| Read ticket audit history | yes | no | **no** |
| List agents, read workload | yes | no | **no** |
| Read reporting metrics | yes | no | **no** |
| Read own summary counts | yes | scoped to own | scoped to `mine` |

**Resolves FE-00/Q2 and FE-04/Q1** — an agent may **not** create a customer. Customer records are a shared reference dataset, and letting every agent create one during intake produces duplicate records for the same organisation within weeks, which then fragments that customer's ticket history and corrupts reporting. An agent selects from existing customers; when none matches, an admin creates it.

**Satisfies FE-04/BR-6** — customer writes are restricted to `admin` server-side, independently of any UI.

**Satisfies FE-03/BR-6** — the workload and organisation-wide summary endpoints reject a non-`admin` caller with 403 regardless of any UI guard.

### Response-embedded capability

**Satisfies FE-06/BR-4** — the single-ticket response includes `available_transitions`: the intersection of what spec 05 says is legal for the current status and what this matrix permits for this user on this ticket. The frontend renders exactly that list.

**Satisfies FE-06/BR-5** — the same response includes `can_assign` and `can_override_priority`, computed here.

Computing capability server-side and shipping it in the payload means the permission rule exists in exactly one language, in one file, and the UI cannot drift from it.

### Tenant isolation (BE-TENANT-ISOLATION)

A `customer` caller's scope is their `customer_id`, read from the database user record, not from the token claim and never from the request.

Three rules make it hold:

1. **Scope is a `WHERE` clause, not a filter.** A row outside the caller's tenant is never fetched. It cannot leak through a count, a log line, or a serialisation mistake, because it was never loaded.
2. **A tenant filter from a customer caller is ignored.** Not honoured, and not rejected either — rejecting it would confirm that other customers exist and that the parameter is meaningful.
3. **Existence is hidden.** A ticket outside the caller's tenant returns 404, identical to a ticket that does not exist, so ids cannot be probed.

A scoping failure here is a data breach rather than a bug: one client sees another client's tickets. Spec 17 covers it as a named invariant with its own test.

### Guards (BE-GUARDS)

| Guard | Responsibility |
|---|---|
| `get_current_user` | Validate the token, load the user, reject if inactive. Raises 401. |
| `require_role(...)` | Assert the user holds one of the given roles. Raises 403. |
| `require_ticket_access` | Load the ticket and assert this user may read it. Raises 404 or 403 per the rule below. |
| `require_customer_scope` | Resolve the caller's `customer_id` and apply it to the query. Raises 401 if a `customer` user has no linked record, which is a data defect. |

**Satisfies FE-11/BR-4** — 401 means no valid identity: absent, malformed, expired token, or a deactivated user. 403 means a valid identity without permission. These are never interchanged, because the frontend clears the session on 401 and merely shows a message on 403; conflating them makes an unauthorised click log the user out.

Scoping is applied inside the query, not after it. An agent's ticket list is filtered in SQL, never fetched and then filtered in Python, so a pagination count can never leak the existence of tickets the caller cannot see.

---

## Rules and Invariants

**R1** — Every non-public route declares a guard. A route with no guard is a defect, verified by a test that walks the route table.

**R2** — The `role` claim is never trusted as authority. The user is re-read and `is_active` re-checked on every request.

**R3** — Permission is enforced in the service layer as well as at the route, so an internal caller cannot bypass it.

**R4** — Scope filters are applied in SQL.

**R5** — 401 and 403 are never substituted for each other.

**R6** — When existence itself is sensitive, 404 is returned instead of 403.

**R7** — No endpoint accepts a role, an actor id, a customer binding, or any other identity field from the request body.

**R8** — A `customer` caller's scope comes from the database record, never from a token claim and never from a request parameter.

**R9** — Cross-tenant access always returns 404, never 403.

---

## Failure Modes

| Situation | Required behaviour |
|---|---|
| Token valid, user deactivated since issuance | 401; the token is not honoured |
| Token valid, role changed since issuance | The database role is used, not the claim |
| Agent requests a ticket assigned to someone else | 404, so the list of other agents' tickets cannot be probed |
| Agent calls an admin endpoint directly | 403 |
| Agent sends `assigned_agent_id` in a create body | Field is absent from the schema and ignored |
| Expired token | 401 with code `unauthenticated` |
| Missing Authorization header on a protected route | 401, never 403 |
| A new route is added without a guard | Route-table test fails |

---

## Acceptance Criteria

1. Every route in the application declares a guard or is explicitly listed as public.
2. A deactivated user cannot act with a previously valid token.
3. A role change takes effect on the next request without reissuing a token.
4. An agent cannot create, update, or list customers through any code path.
5. An agent cannot assign, reassign, close, or override priority through any code path.
6. An agent requesting another agent's ticket receives 404, not 403.
7. `available_transitions`, `can_assign`, and `can_override_priority` are computed server-side and present in every single-ticket response.
8. 401 is returned only for identity failures and 403 only for permission failures, verified by a test per endpoint.
9. Agent list scoping is applied in SQL, and `total` never counts invisible rows.
10. Permission checks exist in the service layer, not only at the route.
11. No request body field anywhere in the API carries an actor identity.
12. A `customer` requesting a ticket outside their linked record receives 404, identical to a non-existent ticket.
13. A customer filter sent by a `customer` caller changes nothing about the result set.
14. A `customer` never receives an assigned agent in any payload, on any endpoint.
15. Tenant scope is read from the database user record, not from the token claim.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | May an agent read unassigned tickets in order to pick one up? | Yes, read-only; assignment remains admin-only | This file, if revisited |
| Q2 | Is a per-endpoint permission test generated from this matrix or written by hand? | Generated from a table mirroring this matrix | `17-TESTING.md` |
