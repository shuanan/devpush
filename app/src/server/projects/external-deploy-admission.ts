// Candidate decision table for a later Prism binding.
// Webhooks, the dashboard, and the API do not call this function.
// It does not read GitHub, land.sh, hold files, pause latches, or hosts,
// and it cannot prove that evidenceSource was produced outside this process.

export const externalDeployAdmissionRefusals = [
  'push_only',
  'dashboard_self_deploy',
  'self_approval',
  'evidence_unbound',
  'pause_latch',
  'hold',
  'ci_not_green',
  'sha_mismatch',
  'review_sha_mismatch',
  'scope_not_allowed',
] as const

export type ExternalDeployAdmissionRefusal =
  (typeof externalDeployAdmissionRefusals)[number]

export type ExternalDeployAdmissionEvent = 'push' | 'user' | 'api' | 'rollback'

export type ExternalDeployEvidenceSource =
  | 'unbound'
  | 'self'
  | 'caller'
  | 'prism-land-record'

export type ExternalDeployCiConclusion =
  | 'success'
  | 'failure'
  | 'pending'
  | 'missing'
  | 'cancelled'

const exactSha = /^[a-f0-9]{40}$/

export type ExternalDeployAdmissionInput = {
  event: ExternalDeployAdmissionEvent
  requestedSha: string
  approvedSha: string | null
  ciConclusion: ExternalDeployCiConclusion
  reviewSha: string | null
  hold: boolean
  pauseLatchSet: boolean
  serviceScope: string
  allowedScopes: readonly string[]
  evidenceSource: ExternalDeployEvidenceSource
}

export type ExternalDeployAdmissionDecision = {
  admit: boolean
  reason: ExternalDeployAdmissionRefusal | null
  pauseLatchCleared: false
  restoresDatabase: false
  restoresVolumes: false
}

function refuse(
  reason: ExternalDeployAdmissionRefusal,
): ExternalDeployAdmissionDecision {
  return {
    admit: false,
    reason,
    pauseLatchCleared: false,
    restoresDatabase: false,
    restoresVolumes: false,
  }
}

export function decideExternalDeployAdmission(
  input: ExternalDeployAdmissionInput,
): ExternalDeployAdmissionDecision {
  if (input.event === 'push') return refuse('push_only')
  if (input.event === 'user') return refuse('dashboard_self_deploy')
  if (input.evidenceSource === 'self' || input.evidenceSource === 'caller') {
    return refuse('self_approval')
  }
  if (input.evidenceSource !== 'prism-land-record') {
    return refuse('evidence_unbound')
  }
  if (input.pauseLatchSet) return refuse('pause_latch')
  if (input.hold) return refuse('hold')
  if (input.ciConclusion !== 'success') return refuse('ci_not_green')
  if (
    !exactSha.test(input.requestedSha) ||
    input.approvedSha !== input.requestedSha
  ) {
    return refuse('sha_mismatch')
  }
  if (input.reviewSha !== input.requestedSha) {
    return refuse('review_sha_mismatch')
  }
  if (
    input.serviceScope.length === 0 ||
    !input.allowedScopes.includes(input.serviceScope)
  ) {
    return refuse('scope_not_allowed')
  }

  return {
    admit: true,
    reason: null,
    pauseLatchCleared: false,
    restoresDatabase: false,
    restoresVolumes: false,
  }
}
