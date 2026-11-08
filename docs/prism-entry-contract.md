---
description: Proposal for binding a devpush SHA to the existing Prism land path.
---

# Prism entry contract

This is a proposal. It does not deploy, does not issue a ticket, and does not add a signature system. devpush push delivery is unchanged.

The source of the land rules is [prism-infra `862e7e5`](https://github.com/shuanan/prism-infra/blob/862e7e5e63b41debd8aebdff4f8c39cecce53254/scripts/land.sh). `scripts/land.sh` takes `<reviewed-sha>` from the caller (`land.sh` lines 4–7 and 32). It checks that the value is 40 hexadecimal characters (lines 37–38) and that `origin/<branch>` is exactly that commit (lines 59–63). It then fast-forwards `main` onto that commit and refuses to push unless `main` equals it (lines 87–93). After that fast-forward, the landed SHA is the reviewed head. A later check-run lookup can use that same SHA. A different merge commit is not that object.

The caller argument is not a machine-verified fresh review. Nothing in `land.sh` reads a review record. Saying that a person typed the SHA does not make the review machine-verified.

## CI evidence

[`.github/workflows/ci.yml`](https://github.com/shuanan/devpush/blob/main/.github/workflows/ci.yml) runs `pull_request` without a branch filter, and `push` only for `main`. Checkout does not set `ref`. On `pull_request`, GitHub's `GITHUB_SHA` is the merge commit, not the head ([events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)).

`scripts/release-ci.mjs` already refuses to reuse a `pull_request` run. It accepts `push` and `workflow_dispatch` only when `head_sha` is the selected commit. This proposal keeps that split. A green pull request check is not land evidence, even if its checkout tree happens to match the head. The merge ref is useful as a test of the combined tree; it is not the commit `land.sh` fast-forwards.

`scripts/ci-evidence.mjs` records `selected_sha`, `checkout_sha`, and `usable_for_land`. `fresh_review` is always false. `usable_for_land` requires a `push` or `workflow_dispatch` event, equal SHAs, and `success` for every job [`scripts/ci-plan.mjs`](https://github.com/shuanan/devpush/blob/main/scripts/ci-plan.mjs) selected. A skipped required job fails that record. Other checks may be `skipped` or `neutral`; the named required job must be `success`. An empty check list is not green. That matches `ci_refusal` in [prism-infra `prism_autodeploy.py`](https://github.com/shuanan/prism-infra/blob/862e7e5e63b41debd8aebdff4f8c39cecce53254/scripts/prism_autodeploy.py) lines 257–268, which also refuses zero runs and requires one named successful run.

The evidence file is an artifact of a future Actions run. It is not a deploy ticket. No run exists for this proposal until Actions produces one. Local tests of the script are not GitHub CI.

`workflow_dispatch` uses the workflow file on the default branch ([workflow_dispatch](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch)). Its payload has no `pull_request.base.sha` and no `before`. The plan then selects the application, agent, and image jobs, so validate, unit, integration, package-consumer, and worker are not skipped for lack of a diff base. A `pull_request` run uses the workflow from the merge of the pull request, and its result still has `usable_for_land` false.

## Hold, pause, and scope

Hold and pause stay in prism-infra. `prism_autodeploy.py` lines 48–61 and 294–298 stop a product when `/etc/prism/autodeploy.off` or `/etc/prism/autodeploy.paused/<product>` exists, during the Taipei quiet windows (lines 115–117), when the running revision is not behind `main`, when CI is not green, or when the diff touches database or compose paths (lines 271–281). Live deploy is limited to `podcast-capture` (lines 167–168) and also requires the host live switch. Failure leaves the pause file until the owner removes it (lines 717–740).

devpush does not read those files and must not clear them. Unknown hold or pause stays refused. The proposal does not add services.

## Who maintains what

Prism2 maintains `land.sh`, the pre-push hook, `prism_autodeploy.py`, the live switch, and the pause files. devpush can show a SHA and a proposal classification. It cannot issue the reviewed SHA, cannot decide hold or pause, and cannot deploy.

`scripts/prism-entry-contract.mjs` returns `deploy: false` and `fresh_review_verified: false` for every input, including a complete same-SHA example. `proposal_only` stays true.

## Backup and restore drill

Not done. A later one-time drill on this runner can use a throwaway file, not a production database:

1. Create a temporary SQLite file, one table, and one inserted row.
2. Copy the file aside. Change the row in the original.
3. Replace the original with the copy and read the row back.
4. Delete the temporary files.

That shows file copy and replace only. It does not show `pg_dump`, Docker volume restore, devpush rollback, or a host drill. Application rollback still does not restore database or volume contents. Do not point the drill at a real database or object store.

## Still blocked

Fork Actions has not produced a workflow run for this repository. The `enabled` flag was not readable here. Do not infer that a settings toggle is off. A person with Administration can open the repository Actions settings and record the `enabled` value from `GET /repos/shuanan/devpush/actions/permissions` ([permissions API](https://docs.github.com/en/rest/actions/permissions#get-github-actions-permissions-for-a-repository)). This proposal does not change that setting and does not start a workflow.

Real Docker, Traefik, an offline agent process, and a database or volume restore are not covered by the script tests.
