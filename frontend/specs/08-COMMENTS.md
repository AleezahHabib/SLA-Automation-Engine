# 08 — Comments

**Status:** Draft
**Owns:** CAP-CMT-THREAD, CAP-CMT-COMPOSE, CAP-CMT-VISIBILITY
**Routes:** None

---

## Owns

| ID | Scope |
|---|---|
| CAP-CMT-THREAD | Rendering the comment thread: ordering, authorship, timestamps, grouping, and empty state. |
| CAP-CMT-COMPOSE | The composer: input, validation, submission, and result handling. |
| CAP-CMT-VISIBILITY | Whether a comment is internal or customer-visible, how that is chosen, and how it is shown. |

This spec describes a region that mounts inside the ticket page. It owns nothing outside that region.

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| Where the comments region sits on the page | CAP-TDET-VIEW — spec 06 |
| Status transitions that may accompany a comment | CAP-TDET-TRANSITION — spec 06 |
| The system audit trail of state changes | `backend/specs/14-AUDIT-LOG.md` |
| Files referenced in a discussion | CAP-ATT-UPLOAD, CAP-ATT-LIST — spec 09 |
| Who may read or write a comment | `backend/specs/04-RBAC.md` |
| Avatar, input, and button primitives | CAP-DS-PRIMITIVES — spec 12 |

**Comments are not the audit log.** The audit log is written by the system when state changes and is immutable. Comments are written by people. They may be displayed near each other in future, but they are different data owned by different specs, and this spec never renders audit entries.

**Two visibility levels exist.** A comment is either **internal** — staff only — or **public**, visible to the customer in the portal. This is the highest-risk surface in the application: an internal note shown to a customer is a real and damaging failure, so visibility is decided server-side and filtered server-side, and the UI never relies on hiding something it has already received.

---

## Consumes

- CAP-AUTH-SESSION — spec 01, to identify the comment author
- CAP-API-CLIENT, CAP-API-ERRORS, CAP-API-QUERY — spec 11
- CAP-DS-PRIMITIVES, CAP-DS-FEEDBACK, CAP-DS-TOKENS — spec 12

---

## Backend Requirements

| # | Requirement |
|---|---|
| BR-1 | An endpoint listing a ticket's comments, ordered oldest first, each with author display name, author role, body, and creation timestamp. |
| BR-2 | An endpoint creating a comment on a ticket, returning the created comment in the same shape the list returns. |
| BR-3 | The author must be taken from the authenticated session. The client must never send an author identifier. |
| BR-4 | Comments must be immutable once created: no edit and no delete endpoint. Immutability is what makes them an audit record. |
| BR-5 | Comment bodies must be length-limited server-side, with the limit documented so the composer can show a counter. |
| BR-6 | Comment list responses must be paginated or bounded, so a long-running ticket cannot return an unbounded payload. |
| BR-7 | A comment must never be creatable on a `closed` ticket; see Q1. |
| BR-8 | Every comment must carry an `is_internal` flag. A `customer` caller's comment list must be filtered server-side to public comments only — an internal comment must never reach the client, not even to be hidden by the UI. |
| BR-9 | A comment created by a `customer` must always be public, with `is_internal` absent from the schema available to that caller so it cannot be set. |

Candidate endpoints — to be confirmed, not assumed:

- `GET /api/v1/tickets/{id}/comments`
- `POST /api/v1/tickets/{id}/comments`

---

## Behaviour

### B1 — Thread rendering (CAP-CMT-THREAD)

Oldest first, so the thread reads as a chronological narrative. A ticket's history should read top to bottom like a story, not newest-first like a feed.

Each entry shows author display name, author role badge, absolute timestamp on hover with a relative timestamp shown, and the body with line breaks preserved.

Consecutive comments by the same author within five minutes are visually grouped under one header, which removes repetition without hiding that they are separate immutable records.

Bodies render as plain text. No markdown, no HTML. This removes an entire class of injection risk from a field that multiple staff write into, and the field is not one where formatting adds value.

### B1a — Visibility (CAP-CMT-VISIBILITY)

Staff choose a visibility when composing. The control is a two-option selector, defaulting to **internal**.

The default matters. Defaulting to public would mean a moment of inattention publishes an internal note to a customer, and the failure is unrecoverable — the customer has already seen it. Defaulting to internal makes the risky action deliberate.

A public comment is marked visually in the staff thread so a reader can tell at a glance which notes the customer can see. Internal comments carry the stronger treatment, because the question a reader asks is "can they see this?"

In the portal, no marking appears at all — every comment a customer receives is public by definition, per BR-8, so a badge would only invite the question of what else exists.

### B2 — Composer (CAP-CMT-COMPOSE)

A multi-line input with a submit action. The input grows to a bounded height and then scrolls.

Empty and whitespace-only submissions are blocked client-side. Length is validated against the limit from BR-5 with a counter appearing as the limit approaches.

Submission is not optimistic. The comment appears only after the server confirms, because an audit record that might not exist should not be shown as if it does.

While in flight the input is disabled and retains its content. On failure the content is preserved and an inline error is shown; the user never loses what they typed.

On success the input clears, the thread revalidates, and the view scrolls to the new comment.

For a `customer` the composer has no visibility control. Per BR-9 the field does not exist in their schema, so every comment they write is public without a choice being offered.

### B3 — Ordering and pagination

If the comment count exceeds the page bound from BR-6, the thread shows the most recent page with a "load earlier" affordance at the top. Older comments load above without moving the reading position.

### B4 — Relationship to the ticket page

Spec 06 mounts this region and passes the ticket identifier. This spec fetches its own data and manages its own loading and error states, so a comment failure never prevents the ticket from rendering.

---

## States and Edge Cases

| Situation | Required behaviour |
|---|---|
| No comments yet | Empty state inviting the first note, with the composer still visible |
| Comment list request fails | Region shows a retry; the ticket page around it still renders |
| Submission fails | Inline error, input content preserved, nothing added to the thread |
| Ticket is `closed` | Composer hidden or disabled with an explanation, per Q1 |
| User lacks permission to comment | Thread renders read-only with no composer |
| Very long single comment | Clamped with an expand action; the region never scrolls sideways |
| Body containing markup characters | Rendered as literal text; never interpreted |
| Another user comments while the page is open | Appears on the next revalidation; the thread is never mutated locally |
| Double submission | Submit disables on first click; a duplicate must not be creatable from the UI |
| Network failure mid-submission | Treated as failure; the client never retries automatically, since a retry could duplicate an audit record |

---

## Acceptance Criteria

1. Comments are ordered oldest first.
2. No edit or delete affordance exists anywhere in this spec.
3. Comment bodies are rendered as plain text, and markup in a body is never interpreted.
4. The composer never sends an author identifier; authorship comes from the session server-side.
5. A comment appears in the thread only after the server confirms it.
6. A failed submission preserves the user's typed content.
7. A failure in the comments region never prevents the ticket page from rendering.
8. The visibility selector defaults to internal on every staff composition.
12. An internal comment is never present in a response served to a `customer`, verified at the network layer rather than in the rendered output.
13. The portal composer offers no visibility control and cannot produce an internal comment.
14. Public comments are visually distinguishable from internal ones in the staff thread, and no marking appears in the portal.
9. This spec renders no audit-log entries.
10. Double-clicking submit cannot create two comments.
11. Loading earlier comments does not move the user's reading position.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | May a comment be added to a `closed` ticket? | No; closure freezes the record | `backend/specs/11-COMMENTS.md` |
| Q2 | Should comments and audit entries eventually share one timeline view? | Not in this scope; separate regions | This file, if revisited |
| Q3 | Is there a maximum comment length, and what is it? | 4000 characters | `backend/specs/11-COMMENTS.md` |
| Q4 | Are comments that existed before visibility was introduced treated as internal or public? | Internal, since they were written under that assumption | `backend/specs/11-COMMENTS.md` |
