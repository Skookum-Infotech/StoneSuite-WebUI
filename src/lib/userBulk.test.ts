import { describe, it, expect } from 'vitest'
import type { WorkspaceUser } from '@/types/tenant'
import {
  bulkMessage,
  confirmText,
  mfaOutcome,
  planBulk,
  skippedSummary,
  type BulkAction,
} from './userBulk'

const ME = 'identity-me'

function user(id: string, over: Partial<WorkspaceUser> = {}): WorkspaceUser {
  return {
    id,
    identityId: `identity-${id}`,
    email: `${id}@example.com`,
    fullName: id.toUpperCase(),
    status: 'active',
    createdAt: '',
    updatedAt: '',
    roles: [],
    mfaEnabled: false,
    mfaAvailable: true,
    ...over,
  }
}

const idsOf = (list: { id: string }[]) => list.map((u) => u.id)

describe('planBulk', () => {
  const cases: { name: string; action: BulkAction; users: WorkspaceUser[]; targets: string[]; skipped: [string, string][] }[] = [
    {
      name: 'turn on: members with it off',
      action: 'mfa-on',
      users: [user('a'), user('b', { mfaEnabled: true })],
      targets: ['a'],
      skipped: [['b', 'already']],
    },
    {
      name: 'turn off: only members with it on',
      action: 'mfa-off',
      users: [user('a'), user('b', { mfaEnabled: true })],
      targets: ['b'],
      skipped: [['a', 'already']],
    },
    {
      name: 'single sign-on has nothing to turn on or off',
      action: 'mfa-on',
      users: [user('a', { mfaAvailable: false })],
      targets: [],
      skipped: [['a', 'sso']],
    },
    {
      name: 'you and deactivated accounts are never targets',
      action: 'mfa-on',
      users: [user('me', { identityId: ME }), user('gone', { status: 'disabled' }), user('a')],
      targets: ['a'],
      skipped: [['me', 'self'], ['gone', 'deactivated']],
    },
    {
      name: 'suspend: only active members',
      action: 'suspend',
      users: [user('a'), user('b', { status: 'suspended' })],
      targets: ['a'],
      skipped: [['b', 'already']],
    },
    {
      name: 'restore: only suspended members',
      action: 'restore',
      users: [user('a'), user('b', { status: 'suspended' })],
      targets: ['b'],
      skipped: [['a', 'already']],
    },
    {
      name: 'you are skipped for suspend too',
      action: 'suspend',
      users: [user('me', { identityId: ME })],
      targets: [],
      skipped: [['me', 'self']],
    },
  ]

  it.each(cases)('$name', ({ action, users, targets, skipped }) => {
    const plan = planBulk(action, users, ME)
    expect(idsOf(plan.targets)).toEqual(targets)
    expect(plan.skipped.map((s) => [s.user.id, s.reason])).toEqual(skipped)
  })
})

describe('skippedSummary', () => {
  it('is empty when nothing was skipped', () => {
    expect(skippedSummary([])).toBe('')
  })

  it('counts members and names each reason once', () => {
    const plan = planBulk('mfa-on', [user('me', { identityId: ME }), user('b', { mfaAvailable: false }), user('c', { mfaAvailable: false })], ME)
    expect(skippedSummary(plan.skipped)).toBe('3 skipped (you, single sign-on)')
  })
})

describe('mfaOutcome', () => {
  const targets = [user('a'), user('b'), user('c')]

  it('counts changed and unchanged as done', () => {
    const out = mfaOutcome(
      [
        { userId: 'a', status: 'changed' },
        { userId: 'b', status: 'unchanged' },
      ],
      targets,
    )
    expect(out).toEqual({ done: 2, failed: [] })
  })

  it('names the members the server skipped or failed', () => {
    const out = mfaOutcome(
      [
        { userId: 'a', status: 'skipped', reason: 'mfa_unavailable' },
        { userId: 'c', status: 'failed' },
        { userId: 'zzz', status: 'failed' },
      ],
      targets,
    )
    expect(out.done).toBe(0)
    expect(out.failed).toEqual([
      { name: 'A', message: 'skipped (mfa_unavailable)' },
      { name: 'C', message: "couldn't be changed" },
      { name: 'A user', message: "couldn't be changed" },
    ])
  })
})

describe('bulkMessage', () => {
  const plan = planBulk('mfa-on', [user('a'), user('b'), user('me', { identityId: ME })], ME)

  it('reports success with what was skipped', () => {
    expect(bulkMessage('mfa-on', plan, { done: 2, failed: [] })).toEqual({
      tone: 'success',
      title: 'Two-step verification turned on for 2 users',
      description: '1 skipped (you)',
    })
  })

  it('uses the singular for one user', () => {
    expect(bulkMessage('suspend', { targets: [], skipped: [] }, { done: 1, failed: [] })).toEqual({
      tone: 'success',
      title: 'Access suspended for 1 user',
      description: undefined,
    })
  })

  it('warns, with the failures named, on a partial result', () => {
    const msg = bulkMessage('restore', { targets: [], skipped: [] }, { done: 1, failed: [{ name: 'B', message: 'Forbidden' }] })
    expect(msg.tone).toBe('warning')
    expect(msg.title).toBe('Access restored for 1 of 2')
    expect(msg.description).toBe('B: Forbidden')
  })

  it('says nothing changed when everything failed', () => {
    const msg = bulkMessage('mfa-off', { targets: [], skipped: [] }, { done: 0, failed: [{ name: 'B', message: 'x' }] })
    expect(msg).toMatchObject({ tone: 'warning', title: 'Nothing was changed' })
  })
})

describe('confirmText', () => {
  it.each<[BulkAction, string]>([
    ['mfa-on', 'Turn on two-step verification for 3 users?'],
    ['mfa-off', 'Turn off two-step verification for 3 users?'],
    ['suspend', 'Suspend access for 3 users?'],
    ['restore', 'Restore access for 3 users?'],
  ])('%s asks about the right action', (action, start) => {
    expect(confirmText(action, 3).startsWith(start)).toBe(true)
  })

  it('uses the singular for one user', () => {
    expect(confirmText('restore', 1)).toBe('Restore access for 1 user?')
  })
})
