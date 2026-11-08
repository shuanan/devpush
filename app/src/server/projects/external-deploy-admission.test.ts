import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

import { decideExternalDeployAdmission } from './external-deploy-admission'
import type { ExternalDeployAdmissionInput } from './external-deploy-admission'

const approvedSha = 'a'.repeat(40)
const otherSha = 'b'.repeat(40)

function approved(
  overrides: Partial<ExternalDeployAdmissionInput> = {},
): ExternalDeployAdmissionInput {
  return {
    event: 'api',
    requestedSha: approvedSha,
    approvedSha,
    ciConclusion: 'success',
    reviewSha: approvedSha,
    hold: false,
    pauseLatchSet: false,
    serviceScope: 'named-scope',
    allowedScopes: ['named-scope'],
    evidenceSource: 'prism-land-record',
    ...overrides,
  }
}

describe('candidate external deploy admission', () => {
  test('admits only an exact SHA backed by an external record', () => {
    const decision = decideExternalDeployAdmission(approved())
    expect(decision).toEqual({
      admit: true,
      reason: null,
      pauseLatchCleared: false,
      restoresDatabase: false,
      restoresVolumes: false,
    })
  })

  test('a matching rollback record still does not restore data or clear a latch', () => {
    expect(
      decideExternalDeployAdmission(approved({ event: 'rollback' })),
    ).toEqual({
      admit: true,
      reason: null,
      pauseLatchCleared: false,
      restoresDatabase: false,
      restoresVolumes: false,
    })
  })

  test('refuses a push even when every other fact matches', () => {
    expect(
      decideExternalDeployAdmission(approved({ event: 'push' })),
    ).toMatchObject({ admit: false, reason: 'push_only' })
  })

  test('refuses a dashboard deploy as a second control plane', () => {
    expect(
      decideExternalDeployAdmission(approved({ event: 'user' })),
    ).toMatchObject({ admit: false, reason: 'dashboard_self_deploy' })
  })

  test.each(['self', 'caller'] as const)(
    'refuses %s evidence instead of accepting a self-approval',
    (evidenceSource) => {
      expect(
        decideExternalDeployAdmission(approved({ evidenceSource })),
      ).toMatchObject({ admit: false, reason: 'self_approval' })
    },
  )

  test('refuses unbound evidence', () => {
    expect(
      decideExternalDeployAdmission(approved({ evidenceSource: 'unbound' })),
    ).toMatchObject({ admit: false, reason: 'evidence_unbound' })
  })

  test('refuses a set pause latch and does not clear it', () => {
    expect(
      decideExternalDeployAdmission(approved({ pauseLatchSet: true })),
    ).toMatchObject({
      admit: false,
      reason: 'pause_latch',
      pauseLatchCleared: false,
    })
  })

  test('refuses a hold', () => {
    expect(
      decideExternalDeployAdmission(approved({ hold: true })),
    ).toMatchObject({ admit: false, reason: 'hold' })
  })

  test.each(['failure', 'pending', 'missing', 'cancelled'] as const)(
    'refuses CI conclusion %s',
    (ciConclusion) => {
      expect(
        decideExternalDeployAdmission(approved({ ciConclusion })),
      ).toMatchObject({ admit: false, reason: 'ci_not_green' })
    },
  )

  test.each([
    { requestedSha: otherSha, approvedSha },
    { requestedSha: approvedSha, approvedSha: null },
    {
      requestedSha: approvedSha.slice(0, 39),
      approvedSha: approvedSha.slice(0, 39),
    },
    {
      requestedSha: approvedSha.toUpperCase(),
      approvedSha: approvedSha.toUpperCase(),
    },
  ])('refuses a SHA that is not the exact approved SHA (%j)', (sha) => {
    expect(decideExternalDeployAdmission(approved(sha))).toMatchObject({
      admit: false,
      reason: 'sha_mismatch',
    })
  })

  test.each([otherSha, null])(
    'refuses a review that does not match the requested SHA (%s)',
    (reviewSha) => {
      expect(
        decideExternalDeployAdmission(approved({ reviewSha })),
      ).toMatchObject({ admit: false, reason: 'review_sha_mismatch' })
    },
  )

  test('an allowlist entry does not admit any other scope', () => {
    expect(
      decideExternalDeployAdmission(approved({ serviceScope: 'other-scope' })),
    ).toMatchObject({ admit: false, reason: 'scope_not_allowed' })
  })

  test('an empty allowlist refuses every scope, including one that already has a separate timer', () => {
    expect(
      decideExternalDeployAdmission(
        approved({ serviceScope: 'podcast-capture', allowedScopes: [] }),
      ),
    ).toMatchObject({ admit: false, reason: 'scope_not_allowed' })
  })

  test('request paths do not call the candidate policy', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const paths = [
      resolve(here, '../github/webhook-handler.ts'),
      resolve(here, './deployments.ts'),
      resolve(here, '../api/mutation-operations.ts'),
    ]
    for (const path of paths) {
      expect(readFileSync(path, 'utf8')).not.toContain(
        'decideExternalDeployAdmission',
      )
    }
  })
})
