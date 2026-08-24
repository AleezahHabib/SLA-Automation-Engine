# 13 — Frontend Testing

**Status:** Draft
**Owns:** CAP-TEST-UNIT, CAP-TEST-INTEGRATION, CAP-TEST-FIXTURES
**Routes:** None

---

## Owns

| ID | Scope |
|---|---|
| CAP-TEST-UNIT | Unit and component test strategy, scope, and conventions. |
| CAP-TEST-INTEGRATION | Integration test strategy: what a flow test covers and how the API is stood in for. |
| CAP-TEST-FIXTURES | Shared fixtures, factories, and mock handlers used by both layers. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| What each feature must do — the tests assert it, they do not define it | Every spec's Acceptance Criteria section |
| Backend test strategy | `backend/specs/17-TESTING.md` |
| The HTTP client being stubbed | CAP-API-CLIENT — spec 11 |
| The components under test | The relevant feature spec |

**Tests assert specifications; they never become one.** Every test traces to a numbered acceptance criterion in another spec. A behaviour that exists only in a test and in no specification is a defect in the specification set, not a feature.

---

## Consumes

- CAP-API-CLIENT, CAP-API-ERRORS, CAP-API-TYPES — spec 11, as the boundary that fixtures stand in for
- CAP-DS-PRIMITIVES — spec 12, rendered by component tests

---

## Backend Requirements

| # | Requirement |
|---|---|
| BR-1 | The OpenAPI schema of spec 11 BR-1 must be stable enough to generate types, since fixtures are typed against the generated types and drift must fail the build. |
| BR-2 | The error envelope of spec 11 BR-2 must be documented precisely, so mock handlers can reproduce every error kind faithfully. |
| BR-3 | Seeded demo data must exist and be documented, so a reviewer can exercise the deployed application manually along the same paths the tests cover. |

No test in this spec requires a running backend.

---

## Behaviour

### B1 — Layers

| Layer | Covers | Runs against |
|---|---|---|
| Unit | Pure logic in isolation | Nothing external |
| Component | One component's rendering and interaction | Mocked network at the HTTP boundary |
| Integration | A user flow across several screens | Mocked network at the HTTP boundary |

There is no layer that runs against a live backend. Tests must run with no database, no server, and no containers, so the suite is fast and reproducible on any machine and in any CI runner.

### B2 — What must be unit tested

Logic with branches and edge cases, tested directly rather than through a rendered component:

| Target | Owning spec |
|---|---|
| The SLA state derivation rule and its formatting | 07 |
| Countdown tick cadence selection | 07 |
| Error normalisation and classification | 11 |
| Case conversion in both directions | 11 |
| URL encoding and decoding of list state | 05 |
| URL encoding and decoding of report period state | 10 |
| Status, priority, and SLA treatment mapping | 12 |

The SLA rule warrants the heaviest coverage in the suite. It has clock-dependent branches, it is the project's defining behaviour, and it is the one place where a client-side error would visibly contradict the backend. Its tests must include: a backend breach indicator overriding local arithmetic in both clock-skew directions, the boundary exactly at the at-risk threshold, the boundary exactly at the deadline, a zero or negative window, and a missing deadline.

Clock-dependent tests use a fixed injected time. A test that reads the real clock is prohibited.

### B3 — What must be component tested

One component, with the network mocked. Each of these traces to acceptance criteria in its owning spec:

- Login form: failure preserves the email and clears the password
- Route guard: no redirect occurs while rehydration is in flight
- Ticket table: an invalid filter value in the URL degrades rather than erroring
- Ticket table: no row contains a control that writes
- Intake form: no priority field is present, and double submission cannot create two tickets
- Transition controls: only transitions the mocked response reports as available are rendered
- Comment composer: a failed submission preserves the typed content
- Attachment upload: a file failing a pre-check produces no network request
- Status badge: an unmapped value produces a visible failure and a logged error
- Portal ticket table: no assignee column is rendered and no assignee filter is offered
- Portal intake form: no customer field exists in the form at all
- Portal ticket page: no action bar, no assignment control, no agent name
- Comment composer: the visibility selector defaults to internal for staff, and is absent for a customer
- Comment thread: a mocked response containing only public comments renders without any internal marking

### B4 — What must be integration tested

Whole flows, network mocked at the HTTP boundary:

1. Sign in as `agent`, land on the agent dashboard, open a ticket from the queue.
2. Sign in as `admin`, land on the admin dashboard, open an unassigned ticket, assign it, see it confirmed only after the mocked response resolves.
3. Create a customer, create a ticket bound to that customer, observe that priority and deadline appear only after creation.
4. Move a ticket through `open`, `in_progress`, `resolved`, then `closed`, including the confirmation step before closing.
5. Attempt a transition the mocked backend rejects, and confirm the UI resynchronises to the returned status.
6. Receive a 401 mid-session and confirm exactly one redirect to sign-in occurs.
7. Sign in as `agent`, navigate to an admin URL directly, and confirm redirection without an error.
8. Apply filters on the ticket list, reload the page, and confirm the view is identical.
9. Register through the customer route, land on `/portal/dashboard`, raise a ticket, and confirm no customer field was sent.
10. Sign in as `customer`, navigate directly to `/admin/dashboard` and `/agent/dashboard`, and confirm redirection to the portal with no error.
11. As `customer`, open a ticket whose mocked response contains only public comments and customer-visible attachments, and confirm nothing internal appears in the rendered output.

Flows 9 through 11 cover the portal boundary. They assert what the UI does with a correctly filtered response — they do **not** substitute for the server-side isolation tests, which are invariants 19 through 21 in `backend/specs/17-TESTING.md`. The frontend cannot prove isolation, because by the time a payload reaches it the filtering has already happened or already failed.

Flow 5 and flow 6 are the highest-value tests in the suite: they are the two places where the frontend must defer to the backend, which is the project's core architectural rule.

### B5 — Fixtures (CAP-TEST-FIXTURES)

One factory per entity, producing objects typed against the generated types from spec 11. A fixture that drifts from the contract fails to compile, which is the point.

Fixtures are built by overriding a valid default, never assembled field by field in a test. A test states only the fields it cares about.

Mock handlers live in one shared set covering the success path plus every error kind in spec 11 B4, so any test can request a specific failure without writing its own handler.

No fixture contains a real name, a real email address, or a real company.

### B6 — What is deliberately not tested

Stated so the omissions are choices rather than gaps: visual appearance beyond structural assertions, third-party library internals, backend behaviour, and real network conditions. Cross-browser verification is manual for this scope.

---

## States and Edge Cases

| Situation | Required behaviour |
|---|---|
| A test needs the current time | A fixed time is injected; the real clock is never read |
| A generated type changes | Fixtures fail to compile, surfacing the drift immediately |
| A mocked endpoint is missing a handler | The test fails loudly rather than silently receiving undefined |
| A flaky timing-dependent assertion | Fixed by controlling time, never by adding a delay |
| A test asserts behaviour absent from every spec | The test is wrong or the specification is incomplete; one of them is corrected |

---

## Acceptance Criteria

1. The entire suite runs with no backend, no database, and no containers.
2. Every test traces to a numbered acceptance criterion in a specification.
3. No test reads the real clock.
4. The SLA derivation rule has explicit tests for both clock-skew directions, both boundaries, a zero window, and a missing deadline.
5. Fixtures are typed against the generated API types, so contract drift fails compilation.
6. Mock handlers exist for every error kind defined in spec 11 B4.
7. Both the rejected-transition flow and the mid-session 401 flow are covered by integration tests.
8. No fixture contains real personal data.
9. An unhandled mocked request fails the test rather than resolving as undefined.
10. Test names state the behaviour asserted, not the function called.
11. Every portal surface is covered by at least one component test and one integration flow.
12. No frontend test is treated as evidence of tenant isolation; that guarantee is asserted server-side.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Which runner and which integration tool are used? | A Vite-native unit runner with a browser-driven integration tool, both configured without containers | This file, if revisited |
| Q2 | Is a coverage threshold enforced? | Not enforced numerically; the traceability rule in criterion 2 is the standard instead | This file, if revisited |
| Q3 | Are visual regression snapshots in scope? | No | This file, if revisited |
