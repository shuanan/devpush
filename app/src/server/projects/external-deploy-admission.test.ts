import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

import { decideExternalDeployAdmission } from './external-deploy-admission'

const sha = 'a'.repeat(40)

const selfFilled = {
  event: 'api',
  requestedSha: sha,
  approvedSha: sha,
  reviewSha: sha,
  ciConclusion: 'success',
  hold: false,
  pauseLatchSet: false,
  evidenceSource: 'prism-land-record',
  serviceScope: 'named-scope',
  allowedScopes: ['named-scope'],
}

const denied = {
  admit: false,
  reason: 'no_verifiable_artifact',
  pauseLatchCleared: false,
  restoresDatabase: false,
  restoresVolumes: false,
} as const

function expectDenied(input?: unknown) {
  expect(decideExternalDeployAdmission(input)).toEqual(denied)
}

describe('deny-only deploy admission stub', () => {
  test('a self-filled SHA and a fake label cannot admit', () => {
    expectDenied(selfFilled)
  })

  test('mutating a result cannot make this or the next call admit', () => {
    const first = decideExternalDeployAdmission(selfFilled)
    expect(Object.isFrozen(first)).toBe(true)
    expect(() => {
      ;(first as { admit: boolean }).admit = true
    }).toThrow(TypeError)
    expect(first.admit).toBe(false)
    const second = decideExternalDeployAdmission({
      ...selfFilled,
      admit: true,
      evidenceSource: 'prism-land-record',
    })
    expect(second).not.toBe(first)
    expect(second).toEqual(denied)
  })

  test('replaying or mutating the same object cannot admit', () => {
    const input = { ...selfFilled }
    expectDenied(input)
    expectDenied(input)
    input.evidenceSource = 'forged-again'
    input.requestedSha = 'b'.repeat(40)
    expectDenied(input)
  })

  test.each([
    undefined,
    null,
    {},
    { event: 'merge' },
    { event: 'push' },
    { event: 'user' },
    { event: 'api' },
    { event: 'rollback' },
    { ...selfFilled, event: undefined },
    { ...selfFilled, event: null },
    { ...selfFilled, event: '' },
    { ...selfFilled, hold: undefined },
    { ...selfFilled, hold: null },
    { ...selfFilled, hold: 0 },
    { ...selfFilled, hold: 'unknown' },
    { ...selfFilled, pauseLatchSet: undefined },
    { ...selfFilled, pauseLatchSet: null },
    { ...selfFilled, pauseLatchSet: 0 },
    { ...selfFilled, pauseLatchSet: 'set' },
    { ...selfFilled, evidenceSource: undefined },
    { ...selfFilled, evidenceSource: null },
    { ...selfFilled, evidenceSource: '' },
    { ...selfFilled, evidenceSource: 'self' },
    { ...selfFilled, evidenceSource: 'caller' },
    { ...selfFilled, ciConclusion: undefined },
    { ...selfFilled, ciConclusion: null },
    { ...selfFilled, ciConclusion: 'skipped' },
    { ...selfFilled, ciConclusion: 'neutral' },
  ])('denies missing or invalid input %j', (input) => {
    expectDenied(input)
  })

  test('the stub source has no approval return', () => {
    const source = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        'external-deploy-admission.ts',
      ),
      'utf8',
    )
    expect(source).not.toMatch(/admit:\s*true/)
  })

  test('production sources do not name the stub; this is a text search, not a call graph', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const roots = [resolve(here, '../..'), resolve(here, '../../../../agent')]
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === 'dist') continue
        const path = resolve(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.(ts|tsx|go)$/.test(name)) files.push(path)
      }
    }
    for (const root of roots) walk(root)
    const mentions = files.filter((path) => {
      if (path.endsWith('external-deploy-admission.ts')) return false
      if (path.endsWith('external-deploy-admission.test.ts')) return false
      return readFileSync(path, 'utf8').includes(
        'decideExternalDeployAdmission',
      )
    })
    expect(mentions).toEqual([])
  })
})
