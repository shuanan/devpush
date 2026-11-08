// Deny-only stub. No machine-verifiable admission artifact exists.
// The argument is ignored. A matching SHA, a fake label, or any hold or
// pause value cannot approve a deployment. Webhooks, the dashboard, the
// API, and rollback do not call this function.

export const externalDeployAdmissionReason = 'no_verifiable_artifact' as const

export type ExternalDeployAdmissionDecision = {
  admit: false
  reason: typeof externalDeployAdmissionReason
  pauseLatchCleared: false
  restoresDatabase: false
  restoresVolumes: false
}

const denied: ExternalDeployAdmissionDecision = {
  admit: false,
  reason: externalDeployAdmissionReason,
  pauseLatchCleared: false,
  restoresDatabase: false,
  restoresVolumes: false,
}

export function decideExternalDeployAdmission(
  _input?: unknown,
): ExternalDeployAdmissionDecision {
  return denied
}
