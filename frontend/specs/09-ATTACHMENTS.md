# 09 — Attachments

**Status:** Draft
**Owns:** CAP-ATT-UPLOAD, CAP-ATT-LIST, CAP-ATT-DOWNLOAD, CAP-ATT-VISIBILITY
**Routes:** None

---

## Owns

| ID | Scope |
|---|---|
| CAP-ATT-UPLOAD | File selection, client-side pre-checks, upload progress, and result handling. |
| CAP-ATT-LIST | Rendering the attachment list: file metadata, ordering, and empty state. |
| CAP-ATT-DOWNLOAD | Retrieving a file for the user, including authenticated retrieval. |
| CAP-ATT-VISIBILITY | Which attachments a `customer` may see, and how uploads are attributed. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| Where the attachments region sits on the ticket page | CAP-TDET-VIEW — spec 06 |
| Where files are physically stored | `backend/specs/12-ATTACHMENTS.md` |
| Which roles may upload or download | `backend/specs/04-RBAC.md` |
| Files discussed in the comment thread | CAP-CMT-THREAD — spec 08 |
| Progress bar, icon, and button primitives | CAP-DS-PRIMITIVES — spec 12 |

**The frontend is not the security boundary for files.** Client-side size and type checks exist to give immediate feedback and to avoid wasting a large upload that will be rejected. They are not enforcement. The backend validates independently and its verdict is final.

---

## Consumes

- CAP-AUTH-SESSION — spec 01, for authenticated retrieval
- CAP-API-CLIENT, CAP-API-ERRORS, CAP-API-QUERY — spec 11
- CAP-DS-PRIMITIVES, CAP-DS-FEEDBACK, CAP-DS-TOKENS — spec 12

---

## Backend Requirements

| # | Requirement |
|---|---|
| BR-1 | An endpoint listing a ticket's attachments with original filename, size, content type, uploader display name, and upload timestamp. |
| BR-2 | An upload endpoint accepting one file per request, returning the created attachment record. |
| BR-3 | Maximum file size and the accepted content-type set must be documented so the client can pre-check with the same values. |
| BR-4 | The backend must validate size and content type independently of any client check, and must reject on the server's own inspection rather than a client-declared type. |
| BR-5 | Retrieval must be authenticated. A file must not be reachable by an unauthenticated party who guesses a URL. |
| BR-6 | The storage target must survive a redeploy. A container filesystem is not durable on the deployment platform, so an external object store or a database-backed blob is required; see Q1. |
| BR-7 | The original filename must be preserved for display and restored on download, while the stored object name must be server-generated so an uploaded name cannot influence a storage path. |
| BR-8 | Deletion must either be unsupported or be restricted and audited; see Q2. |
| BR-9 | Rejection reasons must be distinguishable — too large, wrong type, ticket closed, unauthorised — so the UI can explain what happened. |
| BR-10 | Attachments must carry the same visibility model as comments. A `customer` caller's attachment list must be filtered server-side to customer-visible files only, and a file uploaded by a customer must always be customer-visible. Retrieval must apply the same filter, so an internal file cannot be fetched by guessing its id. |

Candidate endpoints — to be confirmed, not assumed:

- `GET /api/v1/tickets/{id}/attachments`
- `POST /api/v1/tickets/{id}/attachments`
- `GET /api/v1/attachments/{id}/content`

---

## Behaviour

### B1 — Attachment list (CAP-ATT-LIST)

One row per file: type icon, original filename, human-readable size, uploader display name, and relative upload time. Ordered newest first, because the most recently added evidence is usually what is being discussed.

Filenames are rendered as plain text and truncated in the middle, so the extension stays visible.

### B2 — Upload (CAP-ATT-UPLOAD)

A file input plus a drop target covering the region. Both paths run the same pre-checks and the same upload flow.

Pre-checks before any request is made: size against the BR-3 limit, and extension or reported type against the BR-3 accepted set. A file failing a pre-check is rejected immediately with a specific reason and never leaves the browser.

Uploads are one request per file. Selecting several files queues them and uploads them sequentially, so one large failure does not obscure several successes.

Each queued file shows its own state:

| State | Meaning |
|---|---|
| `queued` | Accepted by pre-checks, waiting for its turn |
| `uploading` | In flight, with progress where the browser reports it |
| `complete` | Server confirmed; the row moves into the attachment list |
| `failed` | Rejected or errored, with the reason and a retry action |

A failed file stays visible with its reason until dismissed. Silently dropping a failure would leave the user believing a file was attached.

Uploads are not optimistic. A file joins the list only after the server confirms it.

### B2a — Visibility (CAP-ATT-VISIBILITY)

Attachments follow the comment model exactly, for the same reason and with the same default: staff uploads are **internal** unless deliberately marked customer-visible, and a customer's own uploads are always customer-visible.

An internal file is filtered out server-side per BR-10. It is never delivered to a portal client and then hidden, and its id cannot be used to fetch it.

Applying one visibility model to both comments and attachments is deliberate: two different models would eventually diverge, and the divergence would surface as a leak.

### B3 — Download (CAP-ATT-DOWNLOAD)

Retrieval is authenticated per BR-5, so a plain link carrying no credentials is insufficient. The client requests the content through the API client owned by spec 11, then hands the result to the browser as a download using the original filename from BR-7.

While a retrieval is in flight the row shows a loading state, because an authenticated fetch has no native browser progress indication.

### B4 — Relationship to the ticket page

Spec 06 mounts this region and passes the ticket identifier. This spec fetches its own data and owns its own loading and error states; an attachment failure never prevents the ticket from rendering.

---

## States and Edge Cases

| Situation | Required behaviour |
|---|---|
| No attachments | Empty state with the drop target still active |
| File exceeds the size limit | Rejected before any request, with the limit stated in the message |
| File type not accepted | Rejected before any request, listing accepted types |
| Backend rejects a file the client accepted | Server's reason shown verbatim; client rules are not re-explained |
| Upload interrupted by network loss | Marked `failed` with retry; no partial record appears in the list |
| Several files selected, some fail | Successes appear in the list, failures remain visible with reasons |
| Ticket is `closed` | Upload affordance hidden or disabled per Q3; existing files remain downloadable |
| User lacks upload permission | List renders read-only with no drop target |
| Retrieval returns 403 | Row shows an access error rather than downloading an error page as a file |
| Filename containing markup or path characters | Rendered as literal text; never interpreted, never used to build a local path |
| Very long filename | Middle-truncated with the extension preserved and the full name on hover |
| Duplicate filename on the same ticket | Permitted; disambiguated by upload timestamp in the list |

---

## Acceptance Criteria

1. A file failing a client pre-check never leaves the browser.
2. Client pre-checks use the same limit and type set the backend enforces, sourced from the contract rather than hardcoded independently.
3. A file appears in the attachment list only after the server confirms it.
4. A failed upload remains visible with a specific reason until dismissed.
5. Selecting multiple files uploads them one at a time, each with independent state.
6. Downloads are performed through the authenticated API client, never through an unauthenticated link.
7. A downloaded file is saved under its original filename.
8. Filenames are rendered as plain text and never interpreted as markup or as a path.
9. A failure in the attachments region never prevents the ticket page from rendering.
10. No delete affordance exists unless Q2 resolves to support one.
12. An internal attachment never appears in a response served to a `customer`, verified at the network layer.
13. Retrieval of an internal attachment by a `customer` fails, including by direct id.
14. A customer's own upload is always customer-visible, and the portal offers no visibility control.
11. The region never scrolls the page sideways, regardless of filename length.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Which durable storage target is used, given the platform filesystem is not persistent? | An external object store, decided backend-side; the frontend contract is unaffected either way | `backend/specs/12-ATTACHMENTS.md` |
| Q2 | May an attachment be deleted, and by whom? | Not supported in this scope | `backend/specs/12-ATTACHMENTS.md` |
| Q3 | May files be attached to a `closed` ticket? | No; closure freezes the record, matching spec 08 Q1 | `backend/specs/12-ATTACHMENTS.md` |
| Q4 | Are inline previews needed for images and PDFs? | Not in this scope; download only | This file, if revisited |
