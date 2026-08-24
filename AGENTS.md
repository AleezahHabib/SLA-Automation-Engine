# AGENTS.md — Maintenance & Spec Synchronization Instructions

## Post-Execution Spec Synchronization Rule

> **MANDATORY POST-EXECUTION STEP:**
> Whenever changes, modifications, refactors, or fixes are made to the codebase (backend, frontend, database, worker, or configurations), all corresponding specification files in `backend/specs/` and `frontend/specs/` MUST be updated immediately to reflect the exact state of the implementation.
>
> 1. **Specification Integrity**: Specifications must never drift from the live codebase.
> 2. **Authoritative Hierarchy**: `backend/specs/` remains the source of truth for contracts, domain entities, RBAC, state machines, and SLA rules.
> 3. **Traceability**: Any modified endpoint, field, rule, component, route, or configuration must be synchronized in both the owning spec file and the overview/registry files (`backend/specs/00-OVERVIEW.md`, `frontend/specs/00-OVERVIEW.md`).
> 4. **Acceptance Criteria & Invariants**: Ensure all acceptance criteria in specs match actual verified behavior.
