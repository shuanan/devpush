import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { selectCiRun } from './release-ci.mjs'
import { checksFor } from './ci-plan.mjs'
import { evaluateCiEvidence, evidenceExitProblems, requiredJobNames } from './ci-evidence.mjs'

const head = 'a'.repeat(40)
const merge = 'b'.repeat(40)
const plan = { application: true, agent: true, image: true }
const success = {
  validate: 'success',
  unit: 'success',
  integration: 'success',
  'package-consumer': 'success',
  worker: 'success',
  agent: 'success',
  'production-image': 'success',
  documentation: 'skipped',
}

test('a push run records post-land and does not become preland evidence', () => {
  const result = evaluateCiEvidence({
    event: 'push',
    selectedSha: head,
    checkoutSha: head,
    plan,
    jobResults: success,
  })
  assert.equal(result.usable_for_land, false)
  assert.equal(result.fresh_review, false)
  assert.equal(result.deploy, false)
  assert.ok(result.problems.includes('push_is_post_land'))
  assert.deepEqual(evidenceExitProblems(result), [])
})

test('a pull_request run stays a green report and keeps the land refusal', () => {
  const result = evaluateCiEvidence({
    event: 'pull_request',
    selectedSha: head,
    checkoutSha: head,
    plan,
    jobResults: success,
  })
  assert.equal(result.usable_for_land, false)
  assert.deepEqual(result.problems, ['pull_request_is_not_land_evidence'])
  assert.deepEqual(evidenceExitProblems(result), [])
  assert.equal(selectCiRun([{ id: 1, head_sha: head, event: 'pull_request' }], head), undefined)
})

test('a merge checkout is recorded and still is not land evidence', () => {
  const result = evaluateCiEvidence({
    event: 'pull_request',
    selectedSha: head,
    checkoutSha: merge,
    plan,
    jobResults: success,
  })
  assert.equal(result.selected_sha, head)
  assert.equal(result.checkout_sha, merge)
  assert.equal(result.usable_for_land, false)
})

test('workflow_dispatch fails closed when checkout is a different SHA', () => {
  const result = evaluateCiEvidence({
    event: 'workflow_dispatch',
    selectedSha: head,
    checkoutSha: merge,
    plan,
    jobResults: success,
  })
  assert.ok(result.problems.includes('provenance_unverified'))
  assert.deepEqual(evidenceExitProblems(result), ['checkout_sha_mismatch'])
})

test('dispatch without a base still fails when a required application job is skipped or missing', () => {
  const plan = checksFor({ inputs: null }, [])
  assert.equal(plan.application, true)
  for (const unit of ['skipped', 'failure', undefined]) {
    const result = evaluateCiEvidence({
      event: 'workflow_dispatch',
      selectedSha: head,
      checkoutSha: head,
      plan,
      jobResults: { ...success, unit },
    })
    assert.equal(result.usable_for_land, false)
    assert.equal(result.fresh_review, false)
    assert.ok(result.problems.some((problem) => problem.startsWith('job_unit_')))
  }
  assert.equal(selectCiRun([{ id: 9, head_sha: merge, event: 'pull_request', conclusion: 'success' }], head), undefined)
})

test('a required job that is skipped blocks the run', () => {
  const result = evaluateCiEvidence({
    event: 'push',
    selectedSha: head,
    checkoutSha: head,
    plan,
    jobResults: { ...success, unit: 'skipped' },
  })
  assert.equal(result.usable_for_land, false)
  assert.ok(result.problems.includes('job_unit_skipped'))
})

test('documentation-only plan does not require the application jobs', () => {
  assert.deepEqual(requiredJobNames({ application: false, agent: false, image: false }), ['documentation'])
  const result = evaluateCiEvidence({
    event: 'push',
    selectedSha: head,
    checkoutSha: head,
    plan: { application: false, agent: false, image: false },
    jobResults: { documentation: 'success', unit: 'skipped' },
  })
  assert.equal(result.usable_for_land, false)
  assert.ok(result.problems.includes('push_is_post_land'))
  assert.deepEqual(evidenceExitProblems(result), [])
})

test('the workflow does not retarget checkout or grant the evidence job actions write', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
  assert.match(workflow, /github\.event\.pull_request\.head\.sha/)
  assert.match(workflow, /needs\['package-consumer'\]\.result/)
  assert.match(workflow, /needs\['production-image'\]\.result/)
  assert.equal(/^\s+ref:/m.test(workflow), false)
  assert.equal(workflow.includes('actions: write'), false)
})
