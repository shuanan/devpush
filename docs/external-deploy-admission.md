---
description: Push deploys are unguarded. The deny-only stub cannot approve a SHA.
---

# Deploy admission is unavailable

No machine-verifiable admission artifact exists. `decideExternalDeployAdmission` always returns `admit: false` and `no_verifiable_artifact`. It ignores its argument. A caller can supply a label such as `prism-land-record`, identical SHA strings, a CI conclusion, a hold, or a pause value. Those fields are not read, and none of them approve a deployment. The text `prism-land-record` is not a record.

Webhooks, the dashboard, the API, and rollback do not call the stub. No configuration flag enables approval. This page is not a production integration and not a deploy control plane.

## Push is still unguarded

A signed `push` webhook queues the pushed commit for the first matching environment. The handler does not receive CI, review, hold, or pause-latch facts (`app/src/server/github/webhook-handler.ts`, push branch from line 129). `createDeploymentsForGitHubPush` (`app/src/server/projects/deployments.ts`, from line 545) stores that `gitSha` and queues it with `trigger: 'webhook'`. A disconnected server or an incompatible agent records a failed attempt. That is not an approval gate.

Manual and API deploy can name a SHA only when that SHA is one of the latest commits returned for the branch (`createManualDeployment`, commit selection from line 161). The deploy contract (`app/src/server/api/operation-contract.ts`, `deploy` from line 494) accepts an optional SHA, including either letter case, and no CI, review, or hold field. The GitHub App subscription documented in [Configuration](/docs/configuration/#authentication) is `push` and `installation_target` only. Environment rows (`app/src/server/db/schema.ts`, `environments` from line 693) have no auto-deploy, hold, or approved-SHA column.

There is no native setting that deploys only an exact approved SHA, and none that refuses a red CI result, a review of a different SHA, a hold, or a push-only event.

## What the stub does not do

It does not map a reviewed SHA to the SHA that landed on the branch. It has no nonce, expiry, delivery id, or second read before checkout. It does not bind a CI conclusion to a commit. Missing, null, and invalid hold or pause values are not a separate approval path, because every input is refused. It does not clear a pause latch. `restoresDatabase` and `restoresVolumes` stay false. That flag does not restore data.

[Compose deployments](/docs/compose-deployments/#redeploy-and-rollback) is the home for the runtime limit: rollback skips the pre-deploy command and replays the recorded commit, settings, and variables with current routes. A custom rollback command can still run. A failed pre-deploy command does not undo database writes. `allContainersReady` requires `running`, and a non-empty health value must be `healthy`. An empty health value is currently treated as ready. That predicate is not a live Docker or Traefik check.

## Still required before any connection

Do not install this stub beside an existing deploy timer, and do not widen the service set that timer already covers. Failure pause removal stays with the person who owns that latch. This repository cannot clear it. Older notes that mention merge authority do not authorize merging this repository.

Application rollback will not return database or volume contents. Before any later connection, drill backup and restore on a blank target and keep the result:

1. Copy the database dump, volumes, old SHA, image id, environment file, Compose file, and unit file off the host.
2. Restore onto a blank target and compare row counts and a known record.
3. Roll code and image back to the previous SHA and show that the restored data is unchanged.
4. Repeat after a pre-deploy command that writes, and show that a failed command leaves those writes in place.

This change does not run that drill and does not connect to a database, object store, or host. Do not add object-store usage for it. Live Docker, Traefik, and an agent process going offline are not covered here. Local tests are not CI.
