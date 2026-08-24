# 11 — API Integration

**Status:** Draft
**Owns:** CAP-API-CLIENT, CAP-API-AUTH-HEADER, CAP-API-ERRORS, CAP-API-TYPES, CAP-API-QUERY
**Routes:** None

---

## Owns

| ID | Scope |
|---|---|
| CAP-API-CLIENT | The single HTTP client: base URL resolution, request construction, serialisation, and response parsing. |
| CAP-API-AUTH-HEADER | Attaching credentials to every outgoing request. |
| CAP-API-ERRORS | Turning any failure into one normalised error shape, and classifying it. |
| CAP-API-TYPES | Generating TypeScript types from the backend OpenAPI schema and where they live. |
| CAP-API-QUERY | Data fetching, caching, revalidation, and mutation conventions used by every feature. |

Every network call in the application goes through this spec. No feature may call `fetch` directly.

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| What to do when a session expires | CAP-AUTH-SESSION — spec 01 |
| Where the token is stored | CAP-AUTH-SESSION — spec 01 |
| Which endpoints exist and what they return | `backend/specs/03-API-CONTRACT.md` |
| What a given screen does with the data | The consuming feature spec |
| Toast and error-banner appearance | CAP-DS-FEEDBACK — spec 12 |

**Detection versus reaction.** This spec *detects* an expired session and classifies the failure. Spec 01 *reacts* by clearing the session and redirecting. Splitting them this way keeps the client free of routing knowledge and keeps auth policy in one place.

---

## Consumes

- CAP-AUTH-SESSION — spec 01, to read the current token when constructing a request

---

## Backend Requirements

| # | Requirement |
|---|---|
| BR-1 | The API must serve an OpenAPI schema describing every endpoint, so frontend types can be generated rather than written by hand. |
| BR-2 | Error responses must use one consistent envelope across the entire API, including validation errors, permission errors, and unexpected failures. |
| BR-3 | Validation errors must identify the offending field, so a form can attach a message to the right input. |
| BR-4 | The API must distinguish 401 (no valid session) from 403 (valid session, insufficient permission) correctly, since the UI reacts differently to each. |
| BR-5 | The API must return 409 for a conflicting write, so the UI can refetch and prompt a retry rather than showing a generic failure. |
| BR-6 | The deployed frontend origin must be present in the API's CORS allow-list, including preview origins if previews are used. |
| BR-7 | Payload field naming must be consistent across every endpoint, so one conversion rule covers the whole API. |
| BR-8 | List responses must share one pagination envelope shape across all list endpoints. |
| BR-9 | An unauthenticated health endpoint must exist so a cold start can be detected without a credentialed request. |

---

## Behaviour

### B1 — Base URL

The API base URL comes from a public environment variable read at build time. It is baked into the bundle, which means changing it in the hosting dashboard has no effect until a redeploy. This is recorded here because it is the most common cause of a frontend appearing to point at the wrong backend.

A missing base URL fails the build rather than defaulting to a relative path. A silent fallback would produce requests to the frontend's own origin, which return HTML and surface as confusing parse errors.

### B2 — Credentials (CAP-API-AUTH-HEADER)

The client reads the current token from the session context owned by spec 01 and attaches it as a bearer credential on every request. A request made with no session simply omits the header; it is not blocked client-side, because the server is the authority on what an anonymous caller may do.

No credential is ever placed in a query string, where it would be captured by logs and history.

### B3 — Field naming conversion

The API uses `snake_case`; the frontend uses `camelCase`. Conversion happens in exactly two places inside this module: outgoing bodies are converted one way, incoming bodies the other. No feature performs its own conversion, and no component reads a `snake_case` field.

The one exception is documented explicitly: fields whose values are frozen vocabulary, such as a ticket status, are values rather than keys and are never transformed.

### B4 — Error normalisation (CAP-API-ERRORS)

Every failure — HTTP error, network failure, timeout, or unparseable body — is converted into one error object carrying a machine-readable kind, a human-readable message, optional field-level details, and the original status where one exists.

| Kind | Cause | How consumers react |
|---|---|---|
| `unauthenticated` | 401 | Spec 01 clears the session and redirects |
| `forbidden` | 403 | Feature shows the server's message; no redirect |
| `not_found` | 404 | Feature shows a not-found state |
| `validation` | 422 or equivalent | Form attaches messages to fields |
| `conflict` | 409 | Feature refetches and prompts a retry |
| `server` | 5xx | Feature offers a retry |
| `network` | No response reached | Feature offers a retry, with wording distinct from a credential failure |

A network failure and a credential failure must never produce the same message. Conflating them is what makes a CORS misconfiguration look like a wrong password.

### B5 — Type generation (CAP-API-TYPES)

TypeScript types are generated from the OpenAPI schema of BR-1 into a single generated file under `frontend/types/`, committed to the repository, and regenerated by a script rather than edited.

Generated types are the only permitted description of a response shape. A hand-written interface duplicating a backend model is prohibited, because that is precisely how the zero-divergence requirement is broken.

The frozen vocabulary enums in `frontend/types/enums.ts` are the exception: they are hand-maintained mirrors, and it is a release check that they match the generated types exactly.

### B6 — Fetching and caching (CAP-API-QUERY)

One convention for the whole application: keyed queries with stale-while-revalidate behaviour, revalidation on window focus, and explicit invalidation after a mutation.

| Setting | Value | Reason |
|---|---|---|
| Default stale time | 30 seconds | Ticket state changes often enough that longer feels wrong |
| Revalidate on focus | Yes | Returning to a tab should show current work |
| Retry on `network` and `server` | Twice, with backoff | Absorbs a platform cold start |
| Retry on 4xx | Never | The request will not become valid by repeating it |
| Mutations | Never retried automatically | A retried write can duplicate a record |

Mutations are not optimistic anywhere in this application. Every specification that writes — transitions, assignment, comments, uploads — states the same rule, and this is the module that enforces it.

Query keys include every parameter that affects the result, so two differently filtered lists never share a cache entry.

Signing out discards the entire cache, so no authenticated data survives into the next session in the same browser.

### B7 — Cold start

The backend may be idle and take several seconds to answer its first request. Timeouts must therefore not be aggressive: no request timeout is shorter than 30 seconds, and loading states must tolerate that duration without appearing broken.

---

## States and Edge Cases

| Situation | Required behaviour |
|---|---|
| Base URL missing at build time | Build fails with an explicit message |
| Base URL points at a host that is down | Classified as `network`, never as a credential problem |
| CORS rejection | Classified as `network`; the message must not mention credentials |
| Response body is HTML rather than JSON | Classified as `server`, with the raw body not rendered to the user |
| 401 received on several concurrent requests | Session clears once; exactly one redirect occurs |
| Token expires between two in-flight requests | Both resolve as `unauthenticated`; no retry loop forms |
| Backend returns an unexpected extra field | Ignored; unknown fields never cause a parse failure |
| Backend returns an envelope that does not match BR-2 | Classified as `server` and logged; the user sees a generic retry |
| Very large list response | Handled by pagination, which is required of every list endpoint |

---

## Acceptance Criteria

1. No component or feature calls `fetch` or any HTTP library directly.
2. The base URL is read from a public environment variable, and a missing value fails the build.
3. No credential ever appears in a URL.
4. Case conversion occurs only inside this module, and no component reads a `snake_case` key.
5. Every failure reaching a consumer is one normalised object with a machine-readable kind.
6. A network failure and an authentication failure produce visibly different messages everywhere in the application.
7. A 401 clears the session exactly once regardless of how many requests failed together.
8. No 4xx response is ever retried, and no mutation is ever retried automatically.
9. Response types come from the generated file; no hand-written interface duplicates a backend model.
10. Signing out leaves no cached authenticated data reachable.
11. No request timeout is shorter than 30 seconds.
12. Query keys include every parameter affecting the result.
13. No mutation anywhere in the application is applied optimistically.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Is type generation a manual script or a build step? | A committed script run manually, with a check verifying the committed output is current | This file, if revisited |
| Q2 | Does the API version live in the path or a header? | In the path | `backend/specs/03-API-CONTRACT.md` |
| Q3 | Should preview deployments be allowed by a CORS pattern rather than exact origins? | Yes, a pattern covering preview origins | `backend/specs/16-DEPLOYMENT.md` |
