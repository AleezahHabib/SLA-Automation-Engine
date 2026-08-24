# 12 — Attachments

**Status:** Draft
**Owns:** BE-UPLOAD, BE-STORAGE, BE-RETRIEVE, BE-FILE-VALIDATION, BE-ATTACH-VISIBILITY
**Satisfies:** FE-09/BR-1, FE-09/BR-2, FE-09/BR-3, FE-09/BR-4, FE-09/BR-5, FE-09/BR-6, FE-09/BR-7, FE-09/BR-8, FE-09/BR-9, FE-09/BR-10
**Resolves:** FE-09/Q1, FE-09/Q2, FE-09/Q3

---

## Owns

| ID | Scope |
|---|---|
| BE-UPLOAD | Accepting and recording an uploaded file. |
| BE-STORAGE | Where bytes are durably stored. |
| BE-RETRIEVE | Authenticated retrieval of stored bytes. |
| BE-FILE-VALIDATION | Size and content-type validation. |
| BE-ATTACH-VISIBILITY | Which attachments a `customer` may see or create. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| Who may read a ticket, and therefore its files | BE-PERMISSIONS — spec 04 |
| Client-side pre-checks | `frontend/specs/09-ATTACHMENTS.md` |
| Comments discussing a file | BE-COMMENT-CREATE — spec 11 |

---

## Depends On

- BE-ENTITIES — spec 01
- BE-SCHEMA, BE-CONSTRAINTS — spec 02
- BE-PERMISSIONS — spec 04

---

## Contract

### Storage (BE-STORAGE)

**Resolves FE-09/Q1** — file bytes are stored **in PostgreSQL**, in a dedicated table holding a binary column, one row per attachment, referenced by the `attachments` metadata row.

The reasoning, recorded because this is the decision most likely to be questioned:

- The platform filesystem is ephemeral. Anything written to local disk disappears on the next deploy, so disk is not an option.
- An external object store would solve it, but adds a third vendor, a credential set, and a failure mode outside the two-service architecture this project fixed. The project constraints explicitly exclude introducing further technologies.
- PostgreSQL is already present, already durable, already backed up with the rest of the data, and gives one property no object store does: **the file and its metadata row are written in the same transaction**, so a metadata row can never point at bytes that failed to save.

The trade-off is real and is stated rather than hidden: this does not scale to large files or high volume. Database size grows with attachments, backups grow with them, and a large binary column is not what a relational database is optimised for. The size caps below are what keep the approach honest, and the migration path — moving `storage_key` to point at an object store while the metadata table stays unchanged — is available without a schema redesign, which is why `storage_key` exists as an indirection rather than the bytes being a column on `attachments` directly.

**Satisfies FE-09/BR-6** — storage therefore survives redeploys, because it is the managed database rather than the container.

**Satisfies FE-09/BR-7** — `original_filename` is stored for display and used to name the download. `storage_key` is server-generated and unrelated to it, so an uploaded name can never influence a storage location or be interpreted as a path.

### Validation (BE-FILE-VALIDATION)

**Satisfies FE-09/BR-3** — the limits are published so the client can pre-check with identical values, exposed as constants in the OpenAPI schema description rather than duplicated by hand in two codebases.

| Limit | Value |
|---|---|
| Maximum file size | 5 MB |
| Maximum files per ticket | 10 |
| Maximum total bytes per ticket | 20 MB |
| Accepted types | PNG, JPEG, GIF, WEBP, PDF, plain text, CSV, DOCX, XLSX |

Five megabytes is deliberately modest. It covers the screenshots, logs, and documents a support ticket actually carries, and it is what makes database storage defensible.

**Satisfies FE-09/BR-4** — the server validates independently of any client check, and determines content type by **inspecting the bytes**, not by trusting the declared type or the file extension. A client-declared type is an assertion by the uploader and is treated as one.

The declared type and the detected type must agree. A mismatch is refused rather than silently corrected, because a mismatch is more often an attack than a mistake.

### Upload (BE-UPLOAD)

**Satisfies FE-09/BR-2** — one file per request, returning the created attachment record.

One file per request keeps each failure attributable. A batch endpoint would have to report partial success, and every client would have to handle that shape.

Uploader identity comes from the session. The request carries no uploader field.

**Resolves FE-09/Q3** — uploads to a `closed` ticket are refused, matching the comment rule in spec 11. Closure freezes the record.

Metadata row and bytes are written in one transaction.

### Visibility (BE-ATTACH-VISIBILITY)

**Satisfies FE-09/BR-10** — attachments carry `is_customer_visible`, defaulting to **false**, and follow the comment model in spec 11 exactly.

| Uploader | Result |
|---|---|
| Staff, default | Internal |
| Staff, explicitly marked | Customer-visible |
| `customer` | Always customer-visible; the field is absent from their schema |

Listing for a `customer` filters in the `WHERE` clause. Retrieval applies the same filter, so an internal file cannot be fetched by guessing an id — the check is on the row, not on the route.

One visibility model covers both comments and attachments deliberately. Two models would drift, and the drift would surface as a leak.

### Retrieval (BE-RETRIEVE)

**Satisfies FE-09/BR-5** — retrieval is authenticated and authorised against the parent ticket. There is no signed URL and no public path. A caller who cannot read the ticket cannot read its files, and guessing an attachment id achieves nothing.

Responses set a content-disposition naming the original filename, and a content type taken from server-side detection rather than from the upload request.

Every response carries a header preventing content-type sniffing, so a file cannot be coaxed into executing as something else in a browser.

**Resolves FE-09/Q2** — attachments **cannot be deleted** in this scope. A ticket is an evidentiary record, and the same reasoning that makes comments and audit entries immutable applies to the files attached to them. No delete route exists.

### Errors

**Satisfies FE-09/BR-9** — every rejection is distinguishable by code:

| Code | Cause |
|---|---|
| `payload_too_large` | Exceeds the per-file limit |
| `attachment_quota_exceeded` | Exceeds the per-ticket count or total-bytes limit |
| `unsupported_media_type` | Type not in the accepted set |
| `media_type_mismatch` | Declared and detected types disagree |
| `ticket_closed` | Ticket is `closed` |
| `forbidden` | Caller may not act on this ticket |

**Satisfies FE-09/BR-8** — deletion is unsupported, and this is the documented resolution rather than an omission.

**Satisfies FE-09/BR-1** — the listing endpoint returns original filename, size, content type, uploader display name, and upload timestamp, with the uploader joined in the same query.

---

## Rules and Invariants

**R1** — Content type is determined by inspecting bytes, never by trusting the client.

**R2** — `storage_key` is server-generated and never derived from user input.

**R3** — Metadata and bytes are written in one transaction.

**R4** — Retrieval is always authorised against the parent ticket.

**R5** — No delete path exists for attachments.

**R6** — Uploads are refused on `closed` tickets.

**R7** — Size limits are enforced before the whole body is buffered, so an oversized upload is rejected early rather than after consuming memory.

**R8** — Uploader identity comes from the session.

**R9** — `is_customer_visible` defaults to false in schema, model, and migration.

**R10** — Visibility filtering happens in SQL, on both listing and retrieval.

---

## Failure Modes

| Situation | Required behaviour |
|---|---|
| File exceeds 5 MB | 413 `payload_too_large`, rejected during streaming |
| Ticket already holds 10 files | 422 `attachment_quota_exceeded` |
| Ticket total would exceed 20 MB | 422 `attachment_quota_exceeded` |
| Extension says PDF, bytes say something else | 422 `media_type_mismatch` |
| Type not in the accepted set | 415 `unsupported_media_type` |
| Upload to a `closed` ticket | 409 `ticket_closed` |
| Retrieval by a caller who cannot read the ticket | 404, so existence is not leaked |
| Filename containing path separators | Stored verbatim for display; never used to build a path |
| Byte write fails after metadata insert | Impossible; one transaction covers both |
| Upload aborted mid-stream | Transaction rolls back; no partial record remains |

---

## Acceptance Criteria

1. File bytes survive a redeploy, verified by deploying and re-downloading.
2. Content type is determined by byte inspection, and a mismatch with the declared type is refused.
3. `storage_key` is never derived from the uploaded filename.
4. A file over 5 MB is rejected without the full body being buffered in memory.
5. Per-ticket count and total-size quotas are enforced.
6. Metadata and bytes are always consistent; no metadata row exists without bytes.
7. Retrieval is refused with 404 for a caller who cannot read the ticket.
8. No delete route for attachments exists anywhere.
9. Uploads to a `closed` ticket are refused.
10. Every rejection returns a distinct, documented error code.
11. Downloads restore the original filename and carry a no-sniff header.
12. The listing endpoint issues no per-row uploader lookup.
13. The published limits are the same values the server enforces, sourced from one place.
14. No response served to a `customer` lists an internal attachment.
15. Retrieval of an internal attachment by a `customer` returns 404, including by direct id.
16. A file uploaded by a `customer` is always customer-visible, and the field is absent from their schema.
17. `is_customer_visible` defaults to false in schema, model, and migration.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | At what data volume should storage move to an object store? | When total attachment bytes approach the database plan's limit; `storage_key` makes the move non-breaking | This file, if revisited |
| Q2 | Should uploaded files be virus scanned? | Not in this scope; it requires a scanning service | This file, if revisited |
| Q3 | Should attachments be permitted on `resolved` tickets? | Yes, matching comments; only `closed` freezes the record | This file, if revisited |
