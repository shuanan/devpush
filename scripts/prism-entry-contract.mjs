const sha = /^[0-9a-f]{40}$/

export function sameShaAfterFastForward({ reviewedHead, landedMain }) {
  return sha.test(reviewedHead ?? '') && reviewedHead === landedMain
}

export function ciOnExactSha({ runs, requiredName, expectedSha, repository, event }) {
  if (event === 'push') return { ok: false, reason: 'push_is_post_land' }
  if (event === 'pull_request') return { ok: false, reason: 'pull_request_is_not_land_evidence' }
  if (event !== 'workflow_dispatch') return { ok: false, reason: 'event_not_preland' }
  if (!sha.test(expectedSha ?? '')) return { ok: false, reason: 'expected_sha_missing' }
  if (typeof repository !== 'string' || repository.length === 0) {
    return { ok: false, reason: 'repository_missing' }
  }
  if (!Array.isArray(runs) || runs.length === 0) return { ok: false, reason: 'no_check_runs' }
  for (const run of runs) {
    if (run?.sha !== expectedSha) return { ok: false, reason: 'run_sha_mismatch' }
    if (run?.repository !== repository) return { ok: false, reason: 'repository_mismatch' }
  }
  const incomplete = runs.filter((run) => run.status !== 'completed'
    || !['success', 'skipped', 'neutral'].includes(run.conclusion))
  if (incomplete.length) return { ok: false, reason: 'check_not_green' }
  if (!runs.some((run) => run.name === requiredName && run.conclusion === 'success')) {
    return { ok: false, reason: 'required_job_not_success' }
  }
  return { ok: true, reason: 'supplied_rows_match_sha' }
}

export function classifyEntryRequest(input) {
  const reasons = []
  if (input.reviewedShaSource !== 'origin-branch-head') reasons.push('reviewed_sha_not_from_origin_head')
  if (input.callerClaimsFreshReview) reasons.push('caller_claim_is_not_fresh_review')
  if (!sameShaAfterFastForward({
    reviewedHead: input.reviewedHead,
    landedMain: input.landedMain,
  })) reasons.push('land_sha_differs')
  const ci = ciOnExactSha({
    runs: input.checkRuns,
    requiredName: input.requiredCheck,
    expectedSha: input.reviewedHead,
    repository: input.repository,
    event: input.ciEvent,
  })
  if (!ci.ok) reasons.push(ci.reason)
  if (input.holdKnown !== true) reasons.push('hold_unproven')
  if (input.pauseClear !== true) reasons.push('pause_unproven')
  if (input.scope !== 'podcast-capture') reasons.push('scope_not_live')
  return {
    proposal_only: true,
    deploy: false,
    fresh_review_verified: false,
    same_sha_reusable: sameShaAfterFastForward({
      reviewedHead: input.reviewedHead,
      landedMain: input.landedMain,
    }),
    reasons,
  }
}
