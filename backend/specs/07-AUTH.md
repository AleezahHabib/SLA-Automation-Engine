# 07 — Authentication

**Status:** Draft
**Owns:** BE-REGISTER, BE-LOGIN, BE-TOKEN, BE-CURRENT-USER, BE-HASHING, BE-CUSTOMER-SIGNUP
**Satisfies:** FE-01/BR-1, FE-01/BR-2, FE-01/BR-3, FE-01/BR-4, FE-01/BR-5, FE-01/BR-7, FE-01/BR-8, FE-01/BR-9
**Resolves:** FE-01/Q1, FE-01/Q2, FE-01/Q4

---

## Owns

| ID | Scope |
|---|---|
| BE-REGISTER | User registration. |
| BE-LOGIN | Credential verification and token issuance. |
| BE-TOKEN | Token structure, signing, lifetime, and validation. |
| BE-CURRENT-USER | Resolving a token to a live user record. |
| BE-HASHING | Password hashing policy. |
| BE-CUSTOMER-SIGNUP | Customer self-registration and the record it creates or links to. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| What a role may do | BE-PERMISSIONS — spec 04 |
| Claim semantics as an authority question | BE-JWT-CLAIMS — spec 04 |
| Where the client stores the token | `frontend/specs/01-AUTH-FLOW.md` |
| CORS and allowed origins | BE-CORS — spec 16 |

---

## Depends On

- BE-ENTITIES — spec 01
- BE-JWT-CLAIMS, BE-GUARDS — spec 04
- BE-ERRORS — spec 03

---

## Contract

### Registration (BE-REGISTER)

**Satisfies FE-01/BR-2** — accepts `email`, `password`, `full_name`.

**Resolves FE-01/Q2** — role is **not** accepted from the request. **The endpoint determines the role.** The staff endpoint always creates an `agent`; the customer endpoint always creates a `customer`. Two endpoints rather than one with a parameter means the role is a property of the route, and a route cannot be tampered with the way a body field can.

 The first `admin` is created by the seeded data in spec 17, and further admins are promoted directly in the database in this scope.

Accepting a role at registration would let anyone self-elect to `admin`, which would make the entire permission matrix decorative. The field is absent from the schema, so the attack does not exist rather than being defended against.

**Resolves FE-01/Q1** — registration returns a token immediately and signs the user in. Requiring a second login step after a successful registration adds a screen and no security.

Email is normalised to lower case before storage and comparison, so two casings are one account.

### Customer self-registration (BE-CUSTOMER-SIGNUP)

**Satisfies FE-01/BR-8** — a separate endpoint accepts `email`, `password`, `full_name`, and `company`, and creates a `customer` user together with its Customer binding, in one transaction. No invitation, no admin step.

The binding rule, which is the part that matters:

| Situation | Result |
|---|---|
| No Customer record with that email | A new Customer record is created and linked |
| A Customer record exists with that email and has no linked login | The **existing record is linked**, preserving its ticket history |
| A Customer record exists with that email and already has a login | Registration is refused as a duplicate account |
| A staff User already exists with that email | Refused; one email is one account across the whole system |

The second row is the important one. Without it, an admin who created "Acme Corp" to log a phone call would end up with a second, empty Acme record the moment someone there signed up — and that customer would sign in to find none of their history. Matching on email costs one query and prevents a class of support incident that is very hard to unpick afterwards.

Because self-registration binds one login to one record, a Customer record carries at most one login. Several colleagues from one company each register separately and receive separate records. That is a real limitation of self-service without invitations, and it is recorded in `frontend/specs/14-PORTAL.md` Q3 rather than hidden.

### Login (BE-LOGIN)

**Satisfies FE-01/BR-1** — accepts `email` and `password`; returns an access token and the user's `id`, `email`, `full_name`, and `role`.

**Satisfies FE-01/BR-5** — a wrong credential returns 401 with code `invalid_credentials`. A malformed request returns 422 with field details. These are distinct so the UI can show a field error rather than a banner, and vice versa.

Login never reveals whether an email exists. A wrong password and an unknown email return the identical response, and the password hash comparison is performed even when no user is found, so response timing does not distinguish the two.

A deactivated user's login is rejected with the same generic 401.

### Token (BE-TOKEN)

**Satisfies FE-01/BR-4** — the token carries the `role` claim, so a client can pick a landing route without an extra request. Per spec 04 R2 the claim is a convenience only; every request re-reads the user.

**Resolves FE-01/Q4 and satisfies FE-01/BR-7** — a single access token, no refresh rotation. Lifetime is 12 hours, documented here so the frontend can decide whether to show a session-expiry notice.

Twelve hours covers a working day, so a support agent is not signed out mid-shift, while a stolen token expires the same day. Refresh rotation would add a second credential, a revocation surface, and a cross-site cookie the deployment topology cannot reliably carry — real cost for marginal benefit at this scale.

Tokens are signed with a symmetric secret supplied by environment per spec 16. A missing or short secret fails startup rather than falling back to a default, because a default signing key means anyone can mint an `admin` token.

There is no server-side token revocation list. Deactivating a user is the revocation mechanism, and it takes effect immediately because every request re-reads `is_active`.

### Current user (BE-CURRENT-USER)

**Satisfies FE-01/BR-3** — an endpoint returns the current user from the supplied token, used by the client to rehydrate a session without storing user fields locally.

**Satisfies FE-01/BR-9** — for a `customer` user the response also carries the linked customer id and name. For staff, both fields are **omitted**, not nulled, matching the omission rule in spec 03.

This endpoint is the reason a client can never be trusted about its own role: it must ask, and the answer comes from the database.

### Hashing (BE-HASHING)

Passwords are hashed with a deliberately slow, salted, industry-standard adaptive algorithm. Salt is per-password and generated by the library. Plain text passwords are never logged, never returned, and never stored, including in error messages and request logs.

A minimum password length is enforced at the schema layer. No composition rules are imposed, because they reduce entropy in practice by pushing users toward predictable substitutions.

---

## Rules and Invariants

**R1** — Neither registration endpoint accepts a role. The route determines it.

**R1a** — One email is one account across staff and customers alike.

**R2** — Email is stored and compared in lower case.

**R3** — Authentication failures are indistinguishable between unknown email and wrong password, in both content and timing.

**R4** — The token claim is never used as authority; the user is re-read on every request.

**R5** — A missing or weak signing secret prevents startup.

**R6** — `password_hash` never appears in a response schema.

**R7** — Deactivation is immediate and needs no token revocation.

**R8** — No password or token value is ever written to a log.

---

## Failure Modes

| Situation | Required behaviour |
|---|---|
| Unknown email | 401 `invalid_credentials`, identical to a wrong password |
| Wrong password | 401 `invalid_credentials` |
| Deactivated user logs in | Same generic 401 |
| Duplicate email at registration | 422 with `email` named in details |
| Password below the minimum length | 422 with `password` named in details |
| Expired token on any request | 401 `unauthenticated` |
| Token signed with a different secret | 401; never a 500 |
| Malformed Authorization header | 401 |
| Signing secret absent at startup | Application refuses to start with an explicit message |
| Token valid but the user has been deleted | 401 |

---

## Acceptance Criteria

1. Neither registration schema contains a role field; the staff route always produces an `agent` and the customer route always a `customer`.
13. Customer registration creates the user and its Customer binding in one transaction.
14. Registering with an email that matches an unlinked Customer record links to that record instead of creating a duplicate.
15. Registering with an email already used by any account is refused.
16. A `customer` user is never created without a linked customer record.
17. The current-user response carries customer id and name for a `customer`, and omits both fields for staff.
2. Registration returns a usable token in the same response.
3. An unknown email and a wrong password produce byte-identical responses.
4. Login timing does not reveal whether an email exists.
5. Email comparison is case-insensitive throughout.
6. The token contains `sub`, `role`, `email`, `iat`, and `exp` and nothing sensitive.
7. Token lifetime is 12 hours and is documented in the schema description.
8. Startup fails when the signing secret is missing or too short.
9. `password_hash` is absent from every response schema, verified across the OpenAPI document.
10. Deactivating a user causes their existing token to be rejected on the next request.
11. No log line anywhere contains a password or a token.
12. The current-user endpoint returns fresh database values, never claim values.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Is registration open, or invitation-only in a real deployment? | Open in this scope; noted as a production hardening item | This file, if revisited |
| Q2 | Is there a password reset flow? | Not in this scope; it needs an email channel that does not exist | This file, if revisited |
| Q3 | Should failed logins be rate limited? | Declared as a hardening item alongside spec 03 Q1 | `16-DEPLOYMENT.md` |
