---
description: Candidate rules for admitting one exact SHA without a second deploy control plane.
---

# External deploy admission

This page records what deploy accepts today and a candidate decision table for a later binding. The table is not called by webhooks, the dashboard, the API, or rollback. No configuration flag turns it on. Host paths and trust boundaries are unknown, so this is not a production integration.

## Current admission

A signed `push` webhook queues the pushed commit for the first matching environment. The handler does not receive CI, review, hold, or pause-latch facts (`app/src/server/github/webhook-handler.ts`, push branch from line 129). `createDeploymentsForGitHubPush` (`app/src/server/projects/deployments.ts`, from line 545) matches the branch and queues that SHA. A disconnected server or an incompatible agent records a failed attempt; it does not apply an approval gate.

Manual and API deploy can name a SHA only when that SHA is one of the latest commits returned for the branch (`createManualDeployment`, commit selection from line 161). The deploy contract (`app/src/server/api/operation-contract.ts`, `deploy` from line 494) accepts an optional SHA and no CI, review, or hold field. The GitHub App subscription documented in [Configuration](/docs/configuration/#authentication) is `push` and `installation_target` only. Environment rows (`app/src/server/db/schema.ts`, `environments` from line 693) have no auto-deploy, hold, or approved-SHA column.

There is no native setting that deploys only an exact approved SHA, and none that refuses a red CI result, a review of a different SHA, a hold, or a push-only event.

## Candidate table

`decideExternalDeployAdmission` in `app/src/server/projects/external-deploy-admission.ts` is a pure function. It does not read GitHub, a land script, a hold file, or a host. Passing `evidenceSource: "prism-land-record"` does not prove such a record exists. Caller-supplied or self-supplied evidence is refused. The function never clears a pause latch.

It refuses:

| Condition | Reason |
| --- | --- |
| Event is `push` | `push_only` |
| Event is a dashboard `user` deploy | `dashboard_self_deploy` |
| Evidence source is `self` or `caller` | `self_approval` |
| Evidence source is anything else except the named external record | `evidence_unbound` |
| Pause latch is set | `pause_latch` |
| Hold is set | `hold` |
| CI conclusion is not `success` | `ci_not_green` |
| Requested SHA is not the exact 40-character lowercase approved SHA | `sha_mismatch` |
| Review SHA differs from the requested SHA | `review_sha_mismatch` |
| Service scope is empty or absent from the explicit allowlist | `scope_not_allowed` |

An allowlist entry admits only that scope. An empty allowlist admits nothing. No service name is built in, including a service that already has a separate timer. Admit and refuse results both set `pauseLatchCleared`, `restoresDatabase`, and `restoresVolumes` to false.

`api` and `rollback` reach the evidence checks. A rollback that the table admits still does not restore databases or volumes. [Compose deployments](/docs/compose-deployments/#redeploy-and-rollback) is the home for that runtime limit: rollback skips the pre-deploy command and replays the recorded commit, settings, and variables with current routes. A failed pre-deploy command does not undo database writes. Docker health must be `healthy` when a health status is present (`agent/internal/agent/readiness.go`, `allContainersReady`).

## Before any connection

Do not install this policy beside an existing deploy timer, and do not widen the service set that timer already covers. Failure pause removal stays with the person who owns that latch; this repository cannot clear it. Older notes that mention merge authority do not authorize merging this repository.

Application rollback will not return database or volume contents. Before any later connection, drill backup and restore on a blank target and keep the result:

1. Copy the database dump, volumes, old SHA, image id, environment file, Compose file, and unit file off the host.
2. Restore onto a blank target and compare row counts and a known record.
3. Roll code and image back to the previous SHA and show that the restored data is unchanged.
4. Repeat after a pre-deploy command that writes, and show that a failed command leaves those writes in place.

This change does not run that drill and does not connect to a database, object store, or host. Do not add object-store usage for it.

## Tests that exist here

Unit tests cover the candidate table, positive and negative. A webhook test shows a push still calls the current queue function without CI, review, or hold fields. Agent fixture tests cover an unhealthy container predicate, a rollback that skips pre-deploy, an existing pre-deploy failure fixture, and secret redaction. Those fixtures use stand-in commands, not a Docker daemon. Live Docker, a disconnected agent against this policy, and the backup drill are not end-to-end evidence.
