# 04 — Customers

**Status:** Draft
**Owns:** CAP-CUST-LIST, CAP-CUST-DETAIL, CAP-CUST-CREATE, CAP-CUST-EDIT
**Routes:** `/admin/customers`, `/admin/customers/[customerId]`

---

## Owns

| ID | Scope |
|---|---|
| CAP-CUST-LIST | The customer list view: columns, search, ordering, pagination, empty state. |
| CAP-CUST-DETAIL | The customer detail view: profile presentation and the region where that customer's tickets are shown. |
| CAP-CUST-CREATE | The create-customer form, its validation, and its result handling. |
| CAP-CUST-EDIT | The edit-customer form, its validation, and its result handling. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| The ticket table rendered inside customer detail | CAP-TLIST-TABLE — spec 05 |
| Creating a ticket for this customer | CAP-TDET-CREATE — spec 06 |
| Which customer a ticket is bound to, as a business rule | `backend/specs/08-CUSTOMERS.md` |
| Customer logins and self-registration | CAP-AUTH-REGISTER — spec 01 |
| Everything a customer sees once signed in | CAP-PORT-COMPOSE — spec 14 |
| Form inputs, dialogs, table primitives | CAP-DS-PRIMITIVES — spec 12 |

**This spec manages records; it never creates logins.** Nothing here issues a password or grants a role. A customer login is created only by that customer, through self-registration on `/register/customer` owned by spec 01, and bound by email to an existing record where one matches.

That means two kinds of customer record coexist and both are normal: one with a linked login, and one without — created by an admin to log a ticket raised by phone, and available to be linked later if that person signs up.

---

## Consumes

- CAP-AUTH-GUARD — spec 01, for the `admin` role gate on both routes
- CAP-TLIST-TABLE, CAP-TLIST-PAGINATE — spec 05
- CAP-API-CLIENT, CAP-API-ERRORS, CAP-API-QUERY — spec 11
- CAP-DS-PRIMITIVES, CAP-DS-LAYOUT, CAP-DS-FEEDBACK — spec 12

---

## Backend Requirements

| # | Requirement |
|---|---|
| BR-1 | A paginated customer list endpoint supporting free-text search across name and email. |
| BR-2 | A single-customer endpoint returning the customer's profile fields. |
| BR-3 | A create endpoint that rejects a duplicate email with a field-attributable error, not a generic 500. |
| BR-4 | An update endpoint supporting partial updates. |
| BR-5 | The ticket list endpoint must accept a customer filter so customer detail can show that customer's tickets. |
| BR-6 | Customer write operations must be restricted server-side; see Q1 for which roles. |
| BR-7 | Deletion must either be unsupported or be a soft archive. A customer with tickets must never be hard-deleted, because tickets would lose their binding. |
| BR-8 | Validation errors must identify the offending field so the UI can attach the message to the right input. |
| BR-9 | Customer list and detail responses must indicate whether the record has a linked portal login, derived server-side rather than stored as an independently writable field. |

Candidate endpoints — to be confirmed, not assumed:

- `GET /api/v1/customers`
- `POST /api/v1/customers`
- `GET /api/v1/customers/{id}`
- `PATCH /api/v1/customers/{id}`

---

## Behaviour

### B1 — Customer list (CAP-CUST-LIST)

Columns: name, email, company, open ticket count, portal access, created date. Ordered by name ascending by default.

The portal access column shows whether this record has a linked login. An admin needs it to answer "can this customer see their own tickets, or are we their only channel?" — which changes how a conversation with them is handled.

Search is a single free-text field matching name and email, debounced, and reflected in the URL query string so a filtered list can be shared or restored on reload.

A "New customer" action opens the create form as a dialog rather than a separate route, because creation is short and returning to the list is the expected next step.

### B2 — Customer detail (CAP-CUST-DETAIL)

Two regions: the profile block and the customer's ticket history.

The profile block shows name, email, company, phone, and created date, with an "Edit" action opening the edit form. The ticket history region mounts the table component owned by spec 05, pre-filtered to this customer. This spec declares *where* that region sits and *what filter* it carries; everything inside it belongs to spec 05.

### B3 — Create form (CAP-CUST-CREATE)

Fields: name (required), email (required), company (optional), phone (optional).

Client-side checks are limited to presence and email shape. Uniqueness is decided by the backend, because only the database can know it. A duplicate email attaches its error to the email input.

On success the dialog closes, the list revalidates, and a confirmation is shown through CAP-DS-FEEDBACK.

### B4 — Edit form (CAP-CUST-EDIT)

Same fields as create, pre-populated. Submits only changed fields. The form is disabled while in flight and shows failures inline without discarding the user's input.

### B5 — Binding a ticket to a customer

Ticket creation is owned by spec 06. This spec's only contribution is that customer detail may carry a link into ticket creation with the customer pre-selected. The pre-selection is passed as a route parameter; the form itself, its validation, and its submission belong entirely to spec 06.

---

## States and Edge Cases

| Situation | Required behaviour |
|---|---|
| No customers exist | List shows an empty state whose primary action opens the create form |
| Search returns nothing | Distinct empty state offering to clear the search, not the create action |
| Duplicate email on create | Field-level error on the email input; dialog stays open with input preserved |
| Customer id in the URL does not exist | Not-found state with a link back to the list, not a crash |
| Customer has no tickets | Ticket region shows its own empty state; the profile still renders |
| Ticket region request fails | Profile still renders; only the ticket region shows a retry |
| Two admins edit the same customer concurrently | Last write wins; conflict handling is out of scope, see Q2 |
| An `agent` reaches either route | Redirected by CAP-AUTH-GUARD before any request is made |
| Very long company or name values | Truncated with the full value available on hover; the table never widens the page |

---

## Acceptance Criteria

1. Nothing in this spec creates a login, sets a password, or assigns a role.
12. The customer list shows portal-access status, derived server-side.
13. A record with no linked login renders normally and is never presented as incomplete.
2. The customer list search state is reflected in the URL and survives a page reload.
3. A duplicate email produces an error attached to the email input, never a generic banner.
4. Customer detail renders its ticket history using spec 05's table component, with no table markup defined here.
5. Navigating from customer detail to ticket creation pre-selects that customer, and no ticket form fields are defined in this spec.
6. A non-existent customer id produces a not-found state, not an unhandled error.
7. A failure loading tickets never prevents the profile from rendering.
8. Every write action revalidates the affected list or record on success.
9. No hard-delete affordance exists anywhere in this spec.
10. Both routes are unreachable by an `agent` through the UI, and the backend independently rejects the requests.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | May an `agent` create a customer during ticket intake, or is customer management admin-only? | Admin-only; an agent picks from existing customers | `backend/specs/04-RBAC.md` |
| Q2 | Is optimistic-concurrency control needed on customer edits? | No; last write wins for this scope | `backend/specs/08-CUSTOMERS.md` |
| Q3 | Is `company` a free-text field or a separate entity? | Free-text field on the customer record | `backend/specs/01-DOMAIN-MODEL.md` |
