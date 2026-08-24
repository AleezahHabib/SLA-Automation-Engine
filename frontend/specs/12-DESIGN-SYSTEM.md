# 12 — Design System

**Status:** Draft
**Owns:** CAP-DS-TOKENS, CAP-DS-STATUS-COLOR, CAP-DS-PRIMITIVES, CAP-DS-LAYOUT, CAP-DS-FEEDBACK
**Routes:** None

---

## Owns

| ID | Scope |
|---|---|
| CAP-DS-TOKENS | Colour, spacing, typography, radius, and elevation tokens, including the chart palette parameters. |
| CAP-DS-STATUS-COLOR | The mapping from status, priority, and SLA presentation state to a visual treatment. |
| CAP-DS-PRIMITIVES | Domain-agnostic components: button, input, select, badge, table shell, dialog, tabs, tooltip. |
| CAP-DS-LAYOUT | The application shell: sidebar, top bar, role navigation, page header. |
| CAP-DS-FEEDBACK | Toast, empty state, skeleton, and error boundary. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| Which navigation items a role sees, as a permission question | `backend/specs/04-RBAC.md` |
| Any component that knows what a ticket is | The relevant feature spec |
| The ticket table's columns and behaviour | CAP-TLIST-TABLE — spec 05 |
| The SLA badge and countdown | CAP-SLA-BADGE, CAP-SLA-TIMER — spec 07 |
| Which charts exist and what they show | CAP-MET-CHARTS — spec 10 |
| The sign-out action itself | CAP-AUTH-LOGOUT — spec 01 |

**The dividing line:** the moment a component knows what a ticket, customer, or SLA is, it stops being a primitive and belongs to a feature. A badge is a primitive; a status badge that knows the four ticket statuses is a thin wrapper owned here only because the mapping itself is owned here.

---

## Consumes

Nothing. This spec is the base of the dependency graph and must not depend on any feature spec.

---

## Backend Requirements

None. This spec makes no network requests and requires no endpoint.

The one indirect dependency is that the frozen vocabulary in `00-OVERVIEW.md` Section 3 mirrors `backend/specs/01-DOMAIN-MODEL.md`. If a status or priority value is ever added there, the mapping in B2 must gain a case, and an unmapped value must fail loudly rather than render unstyled.

---

## Behaviour

### B1 — Tokens (CAP-DS-TOKENS)

All colour, spacing, typography, radius, and elevation values are defined once as tokens. No component hardcodes a colour or a pixel value.

Both light and dark themes are defined. Dark is a chosen set of values, not an automatic inversion of light.

The chart palette is a token set defined here and consumed by spec 10:

| Parameter | What it supplies |
|---|---|
| Categorical order | A fixed, ordered list of hues; series take them in order and never cycle |
| Sequential ramp | One hue, light to dark, for magnitude |
| Diverging pair | Two poles with a neutral grey midpoint, for polarity |
| Status palette | Steps for state, kept visually distinct from the categorical order |
| Chart surfaces | The light and dark backgrounds charts are drawn against |

The categorical order must pass a colour-vision separation check against both surfaces before use. This is verified by running the check, not by visual judgement, and the result is recorded. A palette that has not been checked is not a palette.

The categorical order has a fixed ceiling. Additional series are folded into an "Other" group or split into separate charts. A generated additional hue is prohibited, because it is indistinguishable from an existing one under colour-vision deficiency.

### B2 — Status and priority mapping (CAP-DS-STATUS-COLOR)

One mapping, defined here, used everywhere.

| Frozen value | Treatment intent |
|---|---|
| `open` | Neutral, awaiting work |
| `in_progress` | Active, in-flight emphasis |
| `resolved` | Positive, work complete |
| `closed` | Muted, archival |
| `critical` | Highest urgency |
| `high` | Elevated urgency |
| `medium` | Moderate |
| `low` | Lowest |
| `on_track` | Neutral |
| `at_risk` | Warning |
| `breached` | Error |

Priority is an ordered scale, so its four treatments come from one ramp with increasing intensity, not from four unrelated hues. This is the same rule spec 10 applies to priority in charts, and it is stated once here.

Every treatment pairs colour with text. No state is ever communicated by colour alone, so the information survives colour-vision deficiency, greyscale printing, and forced-colours mode.

A value not present in this mapping renders in a visibly wrong fallback and logs an error, so vocabulary drift is caught immediately rather than shipping as a silently unstyled badge.

### B3 — Primitives (CAP-DS-PRIMITIVES)

Button, input, textarea, select, searchable select, checkbox, badge, table shell, dialog, tabs, tooltip, pagination control.

Every primitive is domain-agnostic, keyboard-operable, and carries visible focus. Every interactive primitive has a disabled and a loading state, because the application forbids optimistic writes and therefore needs a loading state on every action that writes.

The table shell provides structure, header, sorting affordance, and horizontal overflow containment. Column definitions come from the consuming feature.

### B4 — Layout (CAP-DS-LAYOUT)

A persistent sidebar, a top bar, and a page-header slot.

The sidebar renders the navigation set for the current role — `admin`, `agent`, or `customer`. It receives that set as data; it does not decide it.

The portal shell is visibly distinct from the staff shell, so a viewer can tell at a glance which side of the system they are on. Distinct does not mean a second design language: the same tokens and primitives, arranged differently and with a different navigation set. The top bar carries the current user's identity and invokes the sign-out action owned by spec 01.

The shell is responsive: the sidebar collapses on narrow viewports. Page content never scrolls sideways; wide content scrolls inside its own container.

### B5 — Feedback (CAP-DS-FEEDBACK)

| Component | Use |
|---|---|
| Toast | Confirming a completed write; never for errors that need a decision |
| Empty state | A region with no data, always distinguishing "nothing exists" from "nothing matched" |
| Skeleton | First load, matching the shape of the content that will replace it |
| Error boundary | Containing a render failure to one region rather than blanking the page |

Skeletons are preferred over spinners for structured content, because a skeleton communicates what is coming.

### B6 — Accessibility baseline

Applies to every component defined here and, by extension, to everything built on them: visible focus on all interactive elements, a contrast floor met by all text and by every status treatment, full keyboard operability, correct labelling of every form control, and honouring the reduced-motion preference.

---

## States and Edge Cases

| Situation | Required behaviour |
|---|---|
| A status value outside the frozen vocabulary | Visibly wrong fallback plus a logged error, never a silent unstyled badge |
| Dark mode | Rendered from its own token values, never by inverting light values |
| Forced-colours mode | Every state remains distinguishable through text and shape |
| Reduced-motion preference | Transitions and chart animations are suppressed |
| Very narrow viewport | Sidebar collapses; no horizontal page scroll appears |
| Content wider than its container | Scrolls inside that container only |
| A render failure inside a region | Contained by an error boundary; the surrounding page survives |
| A colour token used before the palette check has been run | Treated as a release blocker, not a warning |

---

## Acceptance Criteria

1. No component anywhere in the application hardcodes a colour or spacing value.
2. Dark theme values are defined explicitly and are not derived by inversion.
3. Exactly one mapping from status, priority, and SLA state to a treatment exists in the codebase.
4. Priority treatments come from a single ordered ramp, not four unrelated hues.
5. No state is communicated by colour alone, anywhere.
6. A value outside the frozen vocabulary produces a visible failure and a logged error.
7. The categorical chart palette has passed a colour-vision separation check against both surfaces, and the result is recorded.
8. The categorical palette is never extended by generating an additional hue.
9. Every interactive primitive has a disabled state and a loading state.
10. Every interactive element is keyboard-operable with a visible focus indicator.
11. No page scrolls horizontally at any supported viewport width.
12. This spec depends on no feature spec.
13. The sidebar receives its navigation set as data and derives no permissions itself.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Is a user-facing theme toggle required, or is the system preference sufficient? | System preference only for this scope | This file, if revisited |
| Q2 | Are primitives built on a component library or written directly? | Written directly on the token set to avoid importing a competing design language | This file, if revisited |
| Q3 | Which chart library renders the forms specified in spec 10? | Deferred; the token contract in B1 is library-independent | This file, if revisited |
