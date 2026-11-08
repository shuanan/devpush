import assert from 'node:assert/strict'
import test from 'node:test'

import { ciOnExactSha, classifyEntryRequest, sameShaAfterFastForward } from './prism-entry-contract.mjs'

const head = 'a'.repeat(40)
const other = 'b'.repeat(40)

function request(overrides = {}) {
  return {
    reviewedShaSource: 'origin-branch-head',
    callerClaimsFreshReview: false,
    reviewedHead: head,
    landedMain: head,
    checkRuns: [{ name: 'Suite (linux/amd64 container, self-hosted)', status: 'completed', conclusion: 'success' }],
    requiredCheck: 'Suite (linux/amd64 container, self-hosted)',
    holdKnown: true,
    pauseClear: true,
    scope: 'podcast-capture',
    ...overrides,
  }
}

test('fast-forward keeps the reviewed head as the landed SHA', () => {
  assert.equal(sameShaAfterFastForward({ reviewedHead: head, landedMain: head }), true)
  assert.equal(sameShaAfterFastForward({ reviewedHead: head, landedMain: other }), false)
})

test('a caller-supplied reviewed sha is not a verified fresh review', () => {
  const result = classifyEntryRequest(request({ callerClaimsFreshReview: true }))
  assert.equal(result.fresh_review_verified, false)
  assert.equal(result.deploy, false)
  assert.ok(result.reasons.includes('caller_claim_is_not_fresh_review'))
})

test('empty checks and a skipped required job stay refused', () => {
  assert.deepEqual(ciOnExactSha({ runs: [], requiredName: 'Suite' }), { ok: false, reason: 'no_check_runs' })
  assert.equal(ciOnExactSha({
    runs: [
      { name: 'Suite', status: 'completed', conclusion: 'skipped' },
      { name: 'lint', status: 'completed', conclusion: 'success' },
    ],
    requiredName: 'Suite',
  }).reason, 'required_job_not_success')
})

test('unknown hold or pause and a wider scope stay refused', () => {
  const result = classifyEntryRequest(request({
    holdKnown: null,
    pauseClear: false,
    scope: 'other-service',
  }))
  assert.equal(result.deploy, false)
  assert.ok(result.reasons.includes('hold_unproven'))
  assert.ok(result.reasons.includes('pause_unproven'))
  assert.ok(result.reasons.includes('scope_not_live'))
})

test('a complete same-SHA record is still only a proposal', () => {
  const result = classifyEntryRequest(request())
  assert.equal(result.same_sha_reusable, true)
  assert.equal(result.proposal_only, true)
  assert.equal(result.deploy, false)
  assert.equal(result.fresh_review_verified, false)
  assert.deepEqual(result.reasons, [])
})
