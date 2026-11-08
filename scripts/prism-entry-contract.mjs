const sha = /^[0-9a-f]{40}$/

export function sameShaAfterFastForward({ reviewedHead, landedMain }) {
  return sha.test(reviewedHead ?? '') && reviewedHead === landedMain
}

export function ciOnExactSha({ runs, requiredName }) {
  if (!Array.isArray(runs) || runs.length === 0) return { ok: false, reason: 'no_check_runs' }
  const incomplete = runs.filter((run) => run.status !== 'completed'
    || !['success', 'skipped', 'neutral'].includes(run.conclusion))
  if (incomplete.length) return { ok: false, reason: 'check_not_green' }
  if (!runs.some((run) => run.name === requiredName && run.conclusion === 'success')) {
    return { ok: false, reason: 'required_job_not_success' }
  }
  return { ok: true, reason: 'required_job_success' }
}

export function classifyEntryRequest(input) {
  const reasons = []
  if (input.reviewedShaSource !== 'origin-branch-head') reasons.push('reviewed_sha_not_from_origin_head')
  if (input.callerClaimsFreshReview) reasons.push('caller_claim_is_not_fresh_review')
  if (!sameShaAfterFastForward({
    reviewedHead: input.reviewedHead,
    landedMain: input.landedMain,
  })) reasons.push('land_sha_differs')
  const ci = ciOnExactSha({ runs: input.checkRuns, requiredName: input.requiredCheck })
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
