# 05 — Ticket List

**Status:** Draft
**Owns:** CAP-TLIST-TABLE, CAP-TLIST-FILTER, CAP-TLIST-SORT, CAP-TLIST-PAGINATE, CAP-TLIST-SEARCH
**Routes:** `/agent/tickets`, `/admin/tickets`, `/portal/tickets`

---

## Owns

| ID | Scope |
|---|---|
| CAP-TLIST-TABLE | The ticket table component: columns, row rendering, density modes, row click target, empty and loading states. |
| CAP-TLIST-FILTER | Filter controls for status, priority, assignee, and customer, and how filter state is encoded. |
| CAP-TLIST-SORT | Which columns are sortable, default ordering, and how sort state is encoded. |
| CAP-TLIST-PAGINATE | Page size, page navigation, and how page state is encoded. |
| CAP-TLIST-SEARCH | The free-text ticket search control and its debounce behaviour. |

This is the most reused component in the application. Specs 02, 03, and 04 mount it; none of them may redefine any part of it.

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| Everything on a single ticket's page | CAP-TDET-VIEW — spec 06 |
| Creating a ticket | CAP-TDET-CREATE — spec 06 |
| Changing status or assignment from a row | CAP-TDET-TRANSITION, CAP-TDET-ASSIGN — spec 06 |
| The SLA badge inside the SLA column | CAP-SLA-BADGE — spec 07 |
| The rule deciding on-track, at-risk, or breached | CAP-SLA-VISUAL — spec 07 |
| Which panels appear on a dashboard and with what preset filter | CAP-AGENT-QUEUE — spec 02, CAP-ADMIN-UNASSIGNED — spec 03 |
| Table, badge, and select primitives | CAP-DS-PRIMITIVES — spec 12 |
| Status and priority colour values | CAP-DS-STATUS-COLOR — spec 12 |

**No row-level mutations.** A row is a link. Every action that changes a ticket happens on the ticket page owned by spec 06. This keeps one owner for every write path and removes an entire class of permission bugs from list views. See Q1.

---

## Consumes

- CAP-AUTH-GUARD, CAP-AUTH-SESSION — spec 01, for the role gate and for knowing whether to show the assignee column
- CAP-SLA-BADGE, CAP-SLA-VISUAL — spec 07
- CAP-API-QUERY, CAP-API-ERRORS, CAP-API-TYPES — spec 11
- CAP-DS-PRIMITIVES, CAP-DS-LAYOUT, CAP-DS-FEEDBACK, CAP-DS-STATUS-COLOR — spec 12

---

## Backend Requirements

| # | Requirement |
|---|---|
| BR-1 | The ticket list endpoint must support server-side pagination returning the current page, page size, and total count. |
| BR-2 | It must accept filters for status, priority, assigned agent, customer, and unassigned-only, combinable in one request. |
| BR-3 | It must accept a sort field and direction, restricted to a documented allow-list of sortable fields. |
| BR-4 | It must accept a free-text query matched against ticket subject and reference identifier. |
| BR-5 | Sorting must be stable: ties must be broken by a unique column so pagination cannot show or skip the same row twice. |
| BR-6 | Every row must include `sla_deadline`, ticket creation timestamp, and an authoritative breach indicator, so SLA presentation needs no extra request. |
| BR-7 | Every row must include the assigned agent's display name, not only an id, to avoid a lookup request per row. |
| BR-8 | Every row must include the customer's display name for the same reason. |
| BR-9 | Filtering and pagination must be applied in the database. The endpoint must never return the full table for the client to slice. |
| BR-10 | An `agent` requesting the list must receive a result set the backend has already scoped to what that role may see, regardless of the filters sent. |
| BR-11 | A `customer` requesting the list must receive only tickets belonging to their linked customer record, scoped in the query regardless of any filter sent, with `total` counting only those rows. The response must omit the assigned agent entirely for a customer caller. |

Candidate endpoint — to be confirmed, not assumed:

- `GET /api/v1/tickets`

---

## Behaviour

### B1 — Columns (CAP-TLIST-TABLE)

| Column | Notes |
|---|---|
| Reference | Short human-readable ticket identifier; the row's primary link |
| Subject | Truncated to one line |
| Customer | Display name |
| Priority | Badge, coloured through CAP-DS-STATUS-COLOR |
| Status | Badge, coloured through CAP-DS-STATUS-COLOR |
| Assignee | Display name, or an "Unassigned" marker |
| SLA | Rendered entirely by CAP-SLA-BADGE |
| Updated | Relative timestamp |

The Assignee column is hidden when the table is scoped to a single agent's own tickets, because a column with one repeated value is noise.

Two density modes: `comfortable` for full-page routes, `compact` for dashboard panels. Compact hides the Customer and Updated columns. Density is a prop, not a user setting.

**Customer variant.** On `/portal/tickets` the table drops the Customer column, because every row belongs to the same customer, and drops the Assignee column, because which agent holds a ticket is internal operational information. The remaining columns are unchanged, so this is one component with a role-aware column set rather than a second table.

### B2 — Row interaction

The whole row is a link to that ticket's detail page in the current role's route group. There are no buttons, menus, or inline editors in any row.

### B3 — Filters (CAP-TLIST-FILTER)

Controls: status (multi-select), priority (multi-select), assignee (single-select, `admin` only), customer (single-select, `admin` only), and an unassigned-only toggle (`admin` only).

Agents see only the status and priority filters. Customers see only the status filter. Both are UI simplifications, not permissions: the backend scopes the result set regardless, per BR-10 and BR-11.

A customer never sees an assignee or customer filter, because neither is meaningful inside a single customer's own tickets.

All filter state lives in the URL query string. A filtered list is therefore shareable, bookmarkable, and survives reload — and dashboard panels in specs 02 and 03 link here by simply constructing a URL.

### B4 — Sorting (CAP-TLIST-SORT)

Sortable columns: Priority, Status, SLA (by `sla_deadline`), Updated. Default order is `sla_deadline` ascending, so the most urgent ticket is always first.

Reference, Subject, Customer, and Assignee are not sortable in this scope. Sort state lives in the URL.

### B5 — Pagination (CAP-TLIST-PAGINATE)

Server-side, fixed page size of 25 in `comfortable` mode. In `compact` mode the table takes a row limit and renders no pagination controls at all; the owning panel supplies a link to the full list instead.

Page number lives in the URL. Changing any filter, sort, or search resets to page one.

### B6 — Search (CAP-TLIST-SEARCH)

A single text input, debounced at 300ms, matched server-side against subject and reference. Search state lives in the URL and combines with filters rather than replacing them.

### B7 — URL as the single source of list state

Filters, sort, page, and search are all read from and written to the query string. No list state is held in component state, context, or storage. This makes the back button work correctly and makes every list view linkable from anywhere in the application.

---

## States and Edge Cases

| Situation | Required behaviour |
|---|---|
| No tickets at all | Empty state whose primary action leads to ticket creation in spec 06 |
| Filters match nothing | Distinct empty state offering to clear filters, with no creation action |
| Request fails | Error state with retry; existing rows stay visible if this was a refetch |
| First load | Skeleton rows matching the column layout, never a spinner over a blank area |
| A deadline passes while the list is open | The SLA cell updates immediately through CAP-SLA-TIMER; ordering does not change until the next fetch |
| Page number in the URL exceeds the result set | Clamp to the last page and correct the URL |
| Filter value in the URL is not in the frozen vocabulary | Ignore that filter, render the rest, and correct the URL |
| A ticket changes while the list is open | Reflected on the next revalidation; the list never mutates a row locally |
| Long subject or customer name | Truncated with the full value on hover; the page never scrolls sideways |
| Many columns on a narrow viewport | The table scrolls inside its own container |

---

## Acceptance Criteria

1. No row in any table contains a control that writes to the server.
2. All list state — filters, sort, page, search — is fully reconstructable from the URL alone.
3. Copying the URL of a filtered list and opening it in a new tab reproduces the identical view.
4. Default ordering is `sla_deadline` ascending on every route and every density mode.
5. Changing a filter, sort, or the search term resets to page one.
6. Compact mode renders no pagination controls and honours the row limit given by its owning panel.
7. The SLA column contains only the component owned by spec 07; this spec defines no SLA logic.
8. The Assignee column is hidden when the table is scoped to a single agent's own tickets, and is absent entirely on the portal route.
13. On `/portal/tickets` no row exposes an assigned agent, and no filter offers an assignee or customer selection.
9. Pagination never shows the same ticket on two pages, and never skips one, under a stable sort.
10. An invalid filter value in the URL degrades gracefully instead of producing an error state.
11. Every status and priority string matches the frozen vocabulary in `00-OVERVIEW.md` Section 3.
12. Specs 02, 03, and 04 mount this component without redefining any column, filter, or sort behaviour.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Should admins get inline assignment directly from a list row? | No; assignment stays solely with CAP-TDET-ASSIGN | This file, if revisited |
| Q2 | Is the ticket reference a separate human-readable field or the primary key? | A separate short reference field, generated server-side | `backend/specs/01-DOMAIN-MODEL.md` |
| Q3 | Should `closed` tickets be excluded from the default filter? | Yes, excluded by default with a filter to include them | `backend/specs/09-TICKETS.md` |
