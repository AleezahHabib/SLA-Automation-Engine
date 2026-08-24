# 01 — Authentication Flow

**Status:** Draft
**Owns:** CAP-AUTH-LOGIN, CAP-AUTH-REGISTER, CAP-AUTH-SESSION, CAP-AUTH-GUARD, CAP-AUTH-LOGOUT
**Routes:** `/`, `/login`, `/register`, `/register/customer`

---

## Owns

| ID | Scope |
|---|---|
| CAP-AUTH-LOGIN | The login screen, its form, validation, submission, and result handling. |
| CAP-AUTH-REGISTER | The registration screen, its form, validation, submission, and result handling. |
| CAP-AUTH-SESSION | Where the access token lives, how the session is rehydrated on reload, and the React context that exposes the current user. |
| CAP-AUTH-GUARD | Deciding whether a route may render for the current session, and where to redirect when it may not. |
| CAP-AUTH-LOGOUT | Clearing the session and returning the user to the login screen. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| Attaching the token to outgoing requests | CAP-API-AUTH-HEADER — spec 11 |
| Turning a 401 or 403 response into a typed error | CAP-API-ERRORS — spec 11 |
| The sidebar, top bar, and the sign-out button's placement | CAP-DS-LAYOUT — spec 12 |
| Input, button, and form field appearance | CAP-DS-PRIMITIVES — spec 12 |
| Anything rendered after a successful redirect | CAP-AGENT-SUMMARY — spec 02, CAP-ADMIN-SUMMARY — spec 03 |
| Which permissions a role actually carries | `backend/specs/04-RBAC.md` |

This spec decides **whether a session exists and what role it claims**. It never decides what that role is permitted to do.

---

## Consumes

- CAP-API-CLIENT — spec 11, for all network calls
- CAP-API-ERRORS — spec 11, for normalised failure objects
- CAP-DS-PRIMITIVES — spec 12, for inputs, buttons, form layout
- CAP-DS-FEEDBACK — spec 12, for error banners and loading states
- CAP-DS-TOKENS — spec 12, for all colour and spacing values

---

## Backend Requirements

Stated as requirements, not as existing facts. These become input to `backend/specs/07-AUTH.md` and `backend/specs/03-API-CONTRACT.md`, which then become authoritative over this section.

| # | Requirement |
|---|---|
| BR-1 | An endpoint that accepts an email and password and returns an access token plus the authenticated user's id, email, full name, and role. |
| BR-2 | An endpoint that accepts an email, password, and full name, creates a user, and either returns a token directly or requires a subsequent login. See Q1. |
| BR-3 | An endpoint that returns the current user from a supplied token, used to rehydrate a session on page load without storing user fields client-side. |
| BR-4 | The token must carry the user's role as a claim, so the UI can choose a landing route without an extra request. |
| BR-5 | Authentication failure must be distinguishable from validation failure by status code, so the UI can show a field error rather than a banner. |
| BR-6 | The API must accept the deployed frontend origin in its CORS allow-list, including credentials, or authenticated requests will fail in the browser only. |
| BR-7 | Token lifetime must be documented so the UI can decide whether to expose a session-expiry notice. |
| BR-8 | A separate customer self-registration endpoint must create the user account and its linked Customer record in one operation, with no invitation step. Where an unlinked Customer record already exists with that email, registration must link to it rather than create a duplicate. |
| BR-9 | The current-user response must include the linked customer id and customer name for a `customer` user, and omit them for staff, so the portal can label itself without a second request. |

Candidate endpoints — to be confirmed, not assumed:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/register/customer`
- `GET /api/v1/auth/me`

---

## Behaviour

### B1 — Token storage decision

The access token is held in a React context in memory and mirrored to `localStorage` under a single namespaced key so a page reload does not sign the user out.

Rationale, recorded so it is not revisited by accident: the frontend is served from a Vercel domain and the API from a Railway domain, so the two are cross-site. An httpOnly cookie would be a third-party cookie and is blocked by default in several browsers, which would break authentication for a subset of visitors with no client-side remedy. Since every authorisation decision is enforced server-side per `backend/specs/04-RBAC.md`, a stolen token is the only exposure, and token lifetime bounds it.

The stored token is treated as **a hint, never as proof**. The UI must behave correctly when the stored token is absent, malformed, or expired.

### B2 — Session context

A provider mounted at the root layout exposes: the current user or null, an authenticating flag while the initial rehydration is in flight, and the login, register, and logout actions.

On first mount the provider reads the stored token. If a token is present it calls the current-user endpoint (BR-3) to obtain fresh user fields. User fields are never read from storage, because a role read from storage can be edited by the user and must not influence rendering.

While rehydration is in flight, guarded routes render a loading state rather than redirecting. Redirecting during rehydration causes an authenticated user to be bounced to the login screen on every refresh.

### B3 — Login screen

Fields: email, password. Both required. Email is checked for shape only; the backend is authoritative.

On submit the form disables, calls the login endpoint, stores the returned token, populates the session context, and redirects by role per B5. A failed attempt clears only the password field and leaves the email in place.

### B4 — Registration screen

Fields: full name, email, password, confirm password. The confirmation match is checked client-side purely for immediacy; the backend still validates everything.

Role is **not** a form field on either registration screen. A user must not be able to choose their own role; the endpoint they reach determines it. Role assignment is a backend concern and is recorded as Q2.

There are two registration screens, on separate routes rather than one form with a selector:

| Route | Creates | Fields |
|---|---|---|
| `/register` | A staff user with role `agent` | Full name, email, password, confirm |
| `/register/customer` | A `customer` user plus its linked Customer record | Full name, email, password, confirm, company |

A single form with a "sign up as" selector would place the role decision in the client's hands visually, even though the server ignores it. Two routes make the separation structural.

### B5 — Role-based landing

After a successful login or a rehydrated session, `/` resolves as follows:

| Session | Destination |
|---|---|
| none | `/login` |
| role `agent` | `/agent/dashboard` |
| role `admin` | `/admin/dashboard` |
| role `customer` | `/portal/dashboard` |

If a user arrived at a guarded route while signed out, that path is preserved and used as the destination after login instead of the role default, provided it is permitted for their role.

### B6 — Route guard

Guards are implemented in the role-group layouts and are **cosmetic**. They exist so a user never sees a screen full of failed requests. They are not a security boundary; the backend rejects unauthorised requests regardless.

| Condition | Result |
|---|---|
| Rehydration in flight | Render loading state, do not redirect |
| No session | Redirect to `/login`, remembering the attempted path |
| Session role does not match the route group | Redirect to that role's own dashboard |
| A `customer` reaches any staff route | Redirect to `/portal/dashboard`, with no error and no indication the route exists |
| Session role matches | Render |

### B7 — Logout

Clears the in-memory context, removes the stored token, discards any cached request data held under CAP-API-QUERY, and redirects to `/login`. Logout is available from any authenticated screen through the layout owned by spec 12; this spec owns only the action it invokes.

### B8 — Reacting to an expired session

When spec 11 normalises a 401 from any request, this spec's session context clears the session and redirects to `/login` with a notice that the session expired. Detection belongs to spec 11; the reaction belongs here.

---

## States and Edge Cases

| Situation | Required behaviour |
|---|---|
| Stored token present but expired | Rehydration receives 401, session clears silently, user lands on `/login` with no error banner |
| Stored token malformed or truncated | Treated exactly as absent; storage key is removed |
| Network unreachable during login | Error banner offering retry; token storage untouched |
| Backend cold start delays first response | Submit button stays in its loading state until resolution; no timeout shorter than 30 seconds |
| CORS misconfiguration | Surfaces as a network error, not a credential error; the banner must not say "invalid email or password" |
| Registration email already exists | Field-level error on the email input, not a banner |
| User signed in on two tabs, signs out on one | Other tab clears its session on the next 401; cross-tab storage synchronisation is out of scope, see Q3 |
| Direct navigation to `/login` while signed in | Redirect to the role's dashboard |
| Direct navigation to another role's area | Redirect to own dashboard, with no error message |

---

## Acceptance Criteria

1. Refreshing any authenticated page keeps the user signed in and never flashes the login screen.
2. The current user's role is obtained from the backend on every rehydration, never read from `localStorage`.
3. Editing the stored token by hand results in the user being signed out on the next page load, not in a broken screen.
4. Signing in as `agent` lands on `/agent/dashboard`, `admin` on `/admin/dashboard`, and `customer` on `/portal/dashboard`.
5. Requesting a guarded path while signed out, then signing in, lands on the originally requested path when the role permits it.
6. An `agent` navigating to any `/admin/*` route is redirected to `/agent/dashboard` and sees no error.
7. A 401 from any request in the application clears the session and redirects to `/login` exactly once, with no redirect loop.
8. A failed login preserves the entered email and clears only the password.
9. A network failure and an invalid-credentials failure produce visibly different messages.
10. No screen in this spec renders any value drawn from the frozen vocabulary in `00-OVERVIEW.md` Section 3 using a spelling other than the frozen one.
11. Neither registration form exposes a role selection of any kind.
13. Customer registration creates the account and its linked customer record in one submission, with no invitation step.
14. A `customer` navigating to any staff route is redirected to `/portal/dashboard` and learns nothing about that route's existence.
12. Signing out removes the storage key and leaves no cached authenticated data reachable by the next user of the browser.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Does registration return a token immediately, or must the user then log in? | Return a token immediately and sign the user in | `backend/specs/07-AUTH.md` |
| Q2 | How is a role assigned at registration? | The endpoint decides: the staff route always yields `agent`, the customer route always yields `customer`. The seed script creates the first `admin` | `backend/specs/07-AUTH.md` |
| Q3 | Should signing out in one tab sign the user out in all open tabs? | Out of scope for this build | This file, if revisited |
| Q4 | Is a refresh-token rotation needed, or is a single long-lived access token acceptable for this scope? | Single access token, lifetime documented under BR-7 | `backend/specs/07-AUTH.md` |
