# 06 — Ticket Detail and Intake

**Status:** Draft
**Owns:** CAP-TDET-CREATE, CAP-TDET-VIEW, CAP-TDET-TRANSITION, CAP-TDET-ASSIGN
**Routes:** `/agent/tickets/new`, `/agent/tickets/[ticketId]`, `/admin/tickets/[ticketId]`, `/portal/tickets/new`, `/portal/tickets/[ticketId]`

---

## Owns

| ID | Scope |
|---|---|
| CAP-TDET-CREATE | The ticket intake form: fields, validation, submission, and post-creation navigation. |
| CAP-TDET-VIEW | The single-ticket page layout, its header and body, and the regions where other specs mount. |
| CAP-TDET-TRANSITION | The status transition controls: which actions are offered, how they are enabled, and how results are handled. |
| CAP-TDET-ASSIGN | The assignment and reassignment control, and it is the only place in the application where assignment occurs. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| Which transitions are legal | `backend/specs/05-STATE-MACHINE.md` |
| Which role may perform a transition or an assignment | `backend/specs/04-RBAC.md` |
| How priority is scored at intake | `backend/specs/06-SLA.md` |
| The live countdown in the header | CAP-SLA-TIMER, CAP-SLA-VISUAL — spec 07 |
| Everything inside the comments region | CAP-CMT-THREAD, CAP-CMT-COMPOSE — spec 08 |
| Everything inside the attachments region | CAP-ATT-UPLOAD, CAP-ATT-LIST, CAP-ATT-DOWNLOAD — spec 09 |
| The list this page is reached from | CAP-TLIST-TABLE — spec 05 |
| Creating the customer selected at intake | CAP-CUST-CREATE — spec 04 |
| Buttons, dialogs, selects | CAP-DS-PRIMITIVES — spec 12 |

**This spec renders permission, it does not decide it.** Every control here is enabled or disabled from what the backend reports about the current ticket. The frontend never evaluates a rule to reach that conclusion.

---

## Consumes

- CAP-AUTH-GUARD, CAP-AUTH-SESSION — spec 01
- CAP-SLA-TIMER, CAP-SLA-VISUAL — spec 07
- CAP-CMT-THREAD, CAP-CMT-COMPOSE — spec 08
- CAP-ATT-UPLOAD, CAP-ATT-LIST, CAP-ATT-DOWNLOAD — spec 09
- CAP-API-CLIENT, CAP-API-ERRORS, CAP-API-QUERY — spec 11
- CAP-DS-PRIMITIVES, CAP-DS-LAYOUT, CAP-DS-FEEDBACK, CAP-DS-STATUS-COLOR — spec 12

---

## Backend Requirements

| # | Requirement |
|---|---|
| BR-1 | A create-ticket endpoint accepting a customer reference, subject, and description, returning the created ticket including its server-assigned priority and `sla_deadline`. |
| BR-2 | Priority must be assigned by the backend at creation. The client must not send a priority at intake. |
| BR-3 | A single-ticket endpoint returning the full record including customer, assigned agent, timestamps, `sla_deadline`, and authoritative breach status. |
| BR-4 | The single-ticket response must include the set of transitions the requesting user may currently perform, so the UI can render controls without evaluating rules. |
| BR-5 | The single-ticket response must indicate whether the requesting user may assign or reassign this ticket. |
| BR-6 | A transition endpoint that accepts a target status and rejects any illegal or unauthorised transition with a distinguishable error. |
| BR-7 | An assignment endpoint that accepts an agent reference, and supports clearing the assignment only if that is a supported operation; see Q2. |
| BR-8 | An endpoint listing assignable agents, restricted to callers permitted to assign. |
| BR-9 | Transitions and assignments must be atomic and must write an audit entry in the same transaction. |
| BR-10 | A rejected transition must return the current server-side status so the UI can resynchronise without a second request. |
| BR-11 | An endpoint supplying customers selectable at intake, searchable, so intake does not load every customer. |
| BR-12 | Creation by a `customer` must derive the customer binding from the session. The customer field must be absent from the customer intake schema entirely, so a customer cannot file a ticket against another customer. |
| BR-13 | The single-ticket response served to a `customer` must omit the assigned agent and any internal operational field, and must report an empty `available_transitions` with `can_assign` and `can_override_priority` both false. |

Candidate endpoints — to be confirmed, not assumed:

- `POST /api/v1/tickets`
- `GET /api/v1/tickets/{id}`
- `PATCH /api/v1/tickets/{id}/status`
- `PATCH /api/v1/tickets/{id}/assignment`
- `GET /api/v1/agents`

---

## Behaviour

### B1 — Intake form (CAP-TDET-CREATE)

Fields: customer (required, searchable select), subject (required), description (required, multi-line).

Priority is **not** a field. It is assigned by the backend per BR-2 and shown only after creation. This is the visible consequence of the project rule that business logic is deterministic and server-side; letting the reporter choose a priority would make the SLA self-selected.

When reached with a customer pre-selected from spec 04, that customer is filled in and remains changeable.

**Customer variant.** On `/portal/tickets/new` the customer field does not exist. The binding comes from the session per BR-12, so the form is subject and description only. A customer cannot file a ticket against anyone but themselves, and the absence of the field is what guarantees it rather than a check.

On success the user is navigated to the created ticket's detail page, where the assigned priority and resulting deadline are visible for the first time.

### B2 — Page layout (CAP-TDET-VIEW)

| Region | Content | Owner |
|---|---|---|
| Header | Reference, subject, status badge, priority badge, live SLA countdown | This spec; countdown by spec 07 |
| Action bar | Transition controls, assignment control | This spec |
| Body | Description, customer summary, timestamps, assigned agent | This spec |
| Comments region | Internal audit comment thread | Spec 08 |
| Attachments region | Attachment list and upload | Spec 09 |

This spec declares that the comments and attachments regions exist and where they sit. It describes nothing inside them.

### B3 — Transition controls (CAP-TDET-TRANSITION)

**Customer variant.** A customer sees the ticket read-only. Per BR-13 the backend reports no available transitions and no assignment capability, so the action bar renders empty and is omitted rather than shown disabled. The assigned agent is not displayed at all. The customer's participation is through the comment region owned by spec 08 and the attachment region owned by spec 09, both in their customer-visible variants.

The action bar renders one button per transition the backend reports as currently available, per BR-4. Transitions the user may not perform are either absent or shown disabled with the backend's reason; the UI never derives that reason itself.

The transition to `closed` requires a confirmation step, because closure ends the SLA measurement and writes the closure audit entry.

Submissions are not optimistic. The button enters a loading state until the server confirms, because a status is an authoritative fact and showing an unconfirmed one would be a lie about system state.

On rejection, the UI shows the server's message and resynchronises to the status returned per BR-10.

### B4 — Assignment control (CAP-TDET-ASSIGN)

Visible only when the backend reports the user may assign, per BR-5. Opens a searchable list of assignable agents supplied by BR-8.

Reassignment uses the same control; it is not a separate flow. The currently assigned agent is preselected and marked.

Assignment is not optimistic, for the same reason as transitions. On success the page revalidates so the audit trail and any assignment-derived fields are current.

### B5 — SLA presentation in the header

The header shows the live countdown component owned by spec 07, given the `sla_deadline` and creation timestamp from the ticket response. This spec chooses the placement and size variant, nothing else.

Once a ticket is `resolved` or `closed`, the header shows the resolution outcome rather than a running countdown. The wording and states of that display belong to spec 07.

---

## States and Edge Cases

| Situation | Required behaviour |
|---|---|
| Ticket id does not exist | Not-found state with a link back to the list |
| User may view but not act | Page renders read-only; no action bar controls appear |
| Transition rejected as illegal | Server message shown; UI resynchronises to the returned status |
| Transition rejected as unauthorised | Same handling as illegal; no different visual treatment, since both mean "the server said no" |
| Ticket changed by another user while open | The next action returns a conflict; the UI refetches and asks the user to retry |
| Deadline passes while the page is open | Countdown switches to breached presentation immediately, driven by spec 07 |
| Intake submitted twice by double-click | Submit disables on first click; a duplicate must not be creatable from the UI |
| Customer search returns nothing at intake | Empty result with a link to customer creation in spec 04, subject to Q1 in that file |
| Assignment list is empty | Control shows an empty state explaining no assignable agents exist |
| Network failure mid-transition | Error shown, ticket refetched, no local status change retained |
| An `agent` opens an `/admin/tickets/...` URL | Redirected by CAP-AUTH-GUARD to the agent route for the same ticket |

---

## Acceptance Criteria

1. The intake form exposes no priority field of any kind.
2. Priority and `sla_deadline` are first visible only after the backend has created the ticket.
3. Every transition control rendered corresponds to a transition the backend reported as available; the UI computes no transition legality.
4. Assignment appears on this page and nowhere else in the application.
5. No status change or assignment is rendered optimistically; the UI reflects only confirmed server state.
6. A rejected transition leaves the UI showing the server's current status, not the attempted one.
7. Closing a ticket requires an explicit confirmation step.
8. The comments and attachments regions are mounted, not implemented, in this spec.
9. The countdown in the header is the component owned by spec 07, with no SLA arithmetic in this spec.
10. Double-submitting the intake form cannot create two tickets.
11. Every status and priority string matches the frozen vocabulary in `00-OVERVIEW.md` Section 3.
12. A read-only viewer sees the same information with no disabled-looking controls implying missing permission.
13. The portal intake form has no customer field, and the binding is never sent by the client.
14. A `customer` viewing a ticket sees no assigned agent, no action bar, and no assignment control.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Does the single-ticket response carry available transitions, or must the UI request them separately? | Carried in the response per BR-4 | `backend/specs/03-API-CONTRACT.md` |
| Q2 | Can an assignment be cleared back to unassigned? | Yes, admin-only | `backend/specs/10-ASSIGNMENT.md` |
| Q3 | May an admin override the automatically scored priority after creation? | Yes for `admin`, never for `agent` | `backend/specs/06-SLA.md` |
| Q4 | Does reopening a `closed` ticket exist as a transition? | No; a new ticket is created instead | `backend/specs/05-STATE-MACHINE.md` |
