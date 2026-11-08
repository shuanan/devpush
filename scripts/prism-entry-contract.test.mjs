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
    checkRuns: [{
      name: 'Suite (linux/amd64 container, self-hosted)',
      status: 'completed',
      conclusion: 'success',
      sha: head,
      repository: 'shuanan/podcast-capture',
    }],
    requiredCheck: 'Suite (linux/amd64 container, self-hosted)',
    repository: 'shuanan/podcast-capture',
    ciEvent: 'workflow_dispatch',
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

test('check rows must name the expected SHA and repository', () => {
  const base = {
    requiredName: 'Suite',
    expectedSha: head,
    repository: 'shuanan/podcast-capture',
    event: 'workflow_dispatch',
  }
  assert.equal(ciOnExactSha({ ...base, runs: [] }).reason, 'no_check_runs')
  assert.equal(ciOnExactSha({ ...base, expectedSha: undefined, runs: [] }).reason, 'expected_sha_missing')
  assert.equal(ciOnExactSha({
    ...base,
    runs: [{ name: 'Suite', status: 'completed', conclusion: 'success', sha: other, repository: 'shuanan/podcast-capture' }],
  }).reason, 'run_sha_mismatch')
  assert.equal(ciOnExactSha({
    ...base,
    runs: [{ name: 'Suite', status: 'completed', conclusion: 'success', sha: head, repository: 'shuanan/other' }],
  }).reason, 'repository_mismatch')
  assert.equal(ciOnExactSha({ ...base, repository: '', runs: [] }).reason, 'repository_missing')
  assert.equal(ciOnExactSha({ ...base, event: 'push', runs: [] }).reason, 'push_is_post_land')
  assert.equal(ciOnExactSha({ ...base, event: 'pull_request', runs: [] }).reason, 'pull_request_is_not_land_evidence')
  assert.equal(ciOnExactSha({ ...base, event: 'schedule', runs: [] }).reason, 'event_not_preland')
  assert.equal(ciOnExactSha({
    ...base,
    runs: [
      { name: 'Suite', status: 'completed', conclusion: 'skipped', sha: head, repository: 'shuanan/podcast-capture' },
      { name: 'lint', status: 'completed', conclusion: 'success', sha: head, repository: 'shuanan/podcast-capture' },
    ],
  }).reason, 'required_job_not_success')
  assert.equal(ciOnExactSha({
    ...base,
    runs: [{ name: 'Suite', status: 'completed', conclusion: 'failure', sha: head, repository: 'shuanan/podcast-capture' }],
  }).reason, 'check_not_green')
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
