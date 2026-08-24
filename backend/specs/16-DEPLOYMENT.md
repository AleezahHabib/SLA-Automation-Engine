# 16 — Deployment

**Status:** Draft
**Owns:** BE-RAILWAY, BE-ENV, BE-CORS, BE-RELEASE, BE-HEALTH
**Satisfies:** FE-01/BR-6, FE-11/BR-6, FE-11/BR-9
**Resolves:** FE-11/Q3

---

## Owns

| ID | Scope |
|---|---|
| BE-RAILWAY | Platform configuration: services, root directory, build and start. |
| BE-ENV | The environment variable contract. |
| BE-CORS | Cross-origin policy and allowed origins. |
| BE-RELEASE | Migration execution and release ordering. |
| BE-HEALTH | The health endpoint. |

---

## Does Not Own

| Neighbouring concern | Owner |
|---|---|
| Frontend hosting configuration | `frontend/specs/11-API-INTEGRATION.md` |
| Migration authorship and policy | BE-MIGRATIONS — spec 02 |
| Token secret semantics | BE-TOKEN — spec 07 |
| Worker cadence semantics | BE-WORKER-LOOP — spec 13 |

---

## Depends On

- BE-MIGRATIONS — spec 02
- BE-TOKEN — spec 07
- BE-WORKER-LOOP — spec 13

---

## Contract

### Topology (BE-RAILWAY)

```
GitHub  ──▶  Vercel   : frontend   (Root Directory = frontend)
        └─▶  Railway  : backend    (Root Directory = backend)
                        postgres-prod
                        postgres-dev
```

**No Docker.** No Dockerfile, no Docker Compose, no container definition anywhere in this repository. Railway builds the backend from source using its native Python build. This is an explicit project constraint, recorded here so a future contributor does not "helpfully" add one.

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Watch Paths | `/backend/**`, so a documentation change does not redeploy |
| Build | Native Python build from the dependency manifest |
| Start | Bind to the platform-provided port on all interfaces |
| Database | Managed PostgreSQL services in the same project |

The application binds to the port the platform supplies through environment, never a hardcoded one. A hardcoded port produces a service that builds successfully and is unreachable.

### Environment contract (BE-ENV)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Connection string, injected by the platform |
| `JWT_SECRET` | yes | Token signing key; startup fails if absent or too short |
| `JWT_EXPIRY_HOURS` | no | Defaults to 12, per spec 07 |
| `ALLOWED_ORIGINS` | yes | Comma-separated exact origins |
| `ALLOWED_ORIGIN_REGEX` | no | Pattern for preview deployments |
| `SLA_WORKER_ENABLED` | no | Defaults to true; false under test |
| `SLA_WORKER_INTERVAL_SECONDS` | no | Defaults to 60 |
| `MAX_UPLOAD_BYTES` | no | Defaults to the spec 12 limit |
| `LOG_LEVEL` | no | Defaults to info |

Every required variable is validated at startup. A missing one **fails the process immediately** with an explicit message rather than defaulting. A default signing secret or a default permissive origin list is worse than a crash, because the service then runs while being insecure.

**The connection string scheme must be rewritten.** The platform supplies a driver-agnostic PostgreSQL URL, while the async engine requires its own driver prefix. The rewrite happens once in configuration. This is recorded because it is the single most common failure in this exact deployment combination, and its error message does not point at the cause.

The backend uses the private connection string for the production database. The public proxy string is used only from a developer machine against the development database. Production is never reachable from a laptop.

### CORS (BE-CORS)

**Satisfies FE-01/BR-6 and FE-11/BR-6** — the deployed frontend origin is in the allow-list, credentials are permitted, and the required methods and headers are allowed. Without this, every authenticated request fails in the browser while succeeding from curl, which reads as a broken backend and is not one.

**Resolves FE-11/Q3** — preview deployments are permitted through an **origin pattern**, not a growing list of exact origins. Preview URLs change per branch, so an exact list would require a backend redeploy for every new branch.

The pattern is anchored at both ends and matches only the expected preview host shape. An unanchored pattern would match an attacker-controlled domain that merely contains the expected string.

A wildcard origin is never used. It is incompatible with credentialed requests and would permit any site to call the API with a user's token.

### Release (BE-RELEASE)

Two commands, in order:

1. **Release:** apply migrations to head.
2. **Start:** run the API server, which starts the SLA worker in its lifespan.

Migrations run in the release step and **never at application startup**, per spec 02. With more than one instance, startup migrations race.

If the release step fails, the new version does not start and the previous one keeps serving. A failed migration must never leave a partially migrated schema serving traffic.

Deployment order for a first release, because the two platforms depend on each other's URLs:

1. Deploy Railway; obtain the API URL.
2. Deploy Vercel with the API URL configured; obtain the frontend URL.
3. Set `ALLOWED_ORIGINS` on Railway to the frontend URL and redeploy.

Skipping step 3 produces a frontend that loads perfectly and cannot make a single request.

### Health (BE-HEALTH)

**Satisfies FE-11/BR-9** — an unauthenticated health endpoint returns a lightweight response. It exists so the frontend can warm a cold instance without a credentialed request, and so the platform can check liveness.

It reports process liveness and does not query the database. A health check that touches the database turns a slow query into a restart loop.

Cold starts are expected: an idle instance may take seconds to answer. Client timeouts are set accordingly in spec 11 B7.

---

## Rules and Invariants

**R1** — No Docker artifact exists anywhere in the repository.

**R2** — Every required environment variable is validated at startup; a missing one is fatal.

**R3** — No secret has a default value in code.

**R4** — Migrations run only in the release step.

**R5** — The wildcard CORS origin is never used.

**R6** — Any origin pattern is anchored at both ends.

**R7** — The application binds to the platform-supplied port.

**R8** — Production database credentials are never used from a developer machine.

**R9** — The health endpoint performs no database query.

---

## Failure Modes

| Situation | Required behaviour |
|---|---|
| `JWT_SECRET` missing | Process refuses to start with an explicit message |
| `ALLOWED_ORIGINS` missing | Process refuses to start; no permissive default |
| Connection string scheme not rewritten | Caught by a startup assertion, not by a runtime error on first query |
| Migration fails during release | Release fails; previous version keeps serving |
| Frontend origin absent from the allow-list | Browser requests fail; the health endpoint still succeeds, which is the diagnostic signal |
| Two instances start together | Neither migrates; both serve; workers claim disjoint sets per spec 13 |
| Platform port ignored | Detected in a smoke check, since the service builds but never becomes reachable |
| Database unreachable at startup | Application starts and serves health; request endpoints return 500 until connectivity returns |

---

## Acceptance Criteria

1. The repository contains no Dockerfile, Compose file, or container definition.
2. Startup fails explicitly when any required environment variable is absent.
3. No secret has a fallback default anywhere in the codebase.
4. The connection string scheme rewrite is applied and covered by a test.
5. Migrations execute in the release step and never at application startup.
6. A failed migration prevents the new version from serving.
7. CORS permits the deployed frontend origin with credentials.
8. Preview origins are matched by an anchored pattern, and a wildcard origin is never configured.
9. The application binds to the platform-supplied port.
10. The health endpoint is unauthenticated and issues no database query.
11. Watch paths exclude documentation-only changes from triggering a backend deploy.
12. The development database is a separate service from production.

---

## Open Questions

| # | Question | Proposed default | Resolved in |
|---|---|---|---|
| Q1 | Is rate limiting implemented, resolving spec 03 Q1 and spec 07 Q3? | Not in this scope; documented as a hardening item | This file, if revisited |
| Q2 | Is structured JSON logging used, and is a request id propagated into every log line? | Yes; the request id from spec 03's error envelope is logged | This file, if revisited |
| Q3 | Are automated database backups configured beyond the platform default? | Platform default only in this scope | This file, if revisited |
