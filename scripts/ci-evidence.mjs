import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const sha = /^[0-9a-f]{40}$/

// These stay in `problems` and force usable_for_land false.
// They do not fail the job: a green pull_request check is test status, not land evidence.
const reportedNotFailing = new Set([
  'pull_request_is_not_land_evidence',
  'push_is_post_land',
  'provenance_unverified',
])

export function requiredJobNames(plan) {
  const names = plan.application
    ? ['validate', 'unit', 'integration', 'package-consumer', 'worker']
    : ['documentation']
  if (plan.agent) names.push('agent')
  if (plan.image) names.push('production-image')
  return names
}

export function evaluateCiEvidence({
  event,
  selectedSha,
  checkoutSha,
  plan,
  jobResults,
}) {
  const problems = []
  if (!sha.test(selectedSha ?? '') || !sha.test(checkoutSha ?? '')) {
    problems.push('sha_missing')
  }
  if (event === 'pull_request') {
    problems.push('pull_request_is_not_land_evidence')
  } else if (event === 'push') {
    problems.push('push_is_post_land')
  } else if (event === 'workflow_dispatch') {
    problems.push('provenance_unverified')
  } else {
    problems.push('event_not_land_evidence')
  }
  if (
    (event === 'push' || event === 'workflow_dispatch') &&
    sha.test(selectedSha ?? '') &&
    sha.test(checkoutSha ?? '') &&
    selectedSha !== checkoutSha
  ) {
    problems.push('checkout_sha_mismatch')
  }
  for (const name of requiredJobNames(plan)) {
    if (jobResults[name] !== 'success') problems.push(`job_${name}_${jobResults[name] || 'missing'}`)
  }
  return {
    usable_for_land: false,
    fresh_review: false,
    deploy: false,
    problems,
    event,
    selected_sha: selectedSha ?? null,
    checkout_sha: checkoutSha ?? null,
    required_jobs: requiredJobNames(plan),
  }
}

export function evidenceExitProblems(result) {
  return result.problems.filter((problem) => !reportedNotFailing.has(problem))
}

function planFlag(value) {
  return value === 'true'
}

function main() {
  const checkoutSha = process.env.CI_CHECKOUT_SHA
    ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const result = evaluateCiEvidence({
    event: process.env.CI_EVENT,
    selectedSha: process.env.CI_SELECTED_SHA,
    checkoutSha,
    plan: {
      application: planFlag(process.env.CI_PLAN_APPLICATION),
      agent: planFlag(process.env.CI_PLAN_AGENT),
      image: planFlag(process.env.CI_PLAN_IMAGE),
    },
    jobResults: {
      validate: process.env.CI_RESULT_VALIDATE,
      unit: process.env.CI_RESULT_UNIT,
      integration: process.env.CI_RESULT_INTEGRATION,
      'package-consumer': process.env.CI_RESULT_PACKAGE_CONSUMER,
      worker: process.env.CI_RESULT_WORKER,
      documentation: process.env.CI_RESULT_DOCUMENTATION,
      agent: process.env.CI_RESULT_AGENT,
      'production-image': process.env.CI_RESULT_PRODUCTION_IMAGE,
    },
  })
  writeFileSync('ci-sha-evidence.json', `${JSON.stringify(result, null, 2)}\n`)
  if (result.problems.length) console.error(result.problems.join('\n'))
  const exitProblems = evidenceExitProblems(result)
  if (exitProblems.length) process.exitCode = 1
}

if (process.argv[1] && process.argv[1].endsWith('ci-evidence.mjs')) main()
