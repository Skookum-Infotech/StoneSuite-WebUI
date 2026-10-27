import type { MfaChangeResult, WorkspaceUser } from '@/types/tenant'

// Bulk actions on Configuration > Users. Everything here is pure: deciding who
// an action applies to, and wording what happened, so both are table-tested.

export type BulkAction = 'mfa-on' | 'mfa-off' | 'suspend' | 'restore'

export type SkipReason = 'self' | 'deactivated' | 'sso' | 'already'

export interface BulkPlan {
  targets: WorkspaceUser[]
  skipped: { user: WorkspaceUser; reason: SkipReason }[]
}

export interface BulkFailure {
  name: string
  message: string
}

export interface BulkOutcome {
  done: number
  failed: BulkFailure[]
}

export const SKIP_LABEL: Record<SkipReason, string> = {
  self: 'you',
  deactivated: 'deactivated',
  sso: 'single sign-on',
  already: 'already that way',
}

const DONE_LABEL: Record<BulkAction, string> = {
  'mfa-on': 'Two-step verification turned on',
  'mfa-off': 'Two-step verification turned off',
  suspend: 'Access suspended',
  restore: 'Access restored',
}

export const BULK_MFA_ACTIONS: readonly BulkAction[] = ['mfa-on', 'mfa-off']

export const displayName = (u: WorkspaceUser): string => u.fullName || u.email

export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

// Who an action applies to. You are never a target (your own two-step goes
// through Account Settings, and suspending yourself locks you out), nor is a
// deactivated account; the rest depend on the action.
export function planBulk(action: BulkAction, users: WorkspaceUser[], selfIdentityId: string | undefined): BulkPlan {
  const plan: BulkPlan = { targets: [], skipped: [] }
  for (const user of users) {
    const reason = skipReason(action, user, selfIdentityId)
    if (reason) plan.skipped.push({ user, reason })
    else plan.targets.push(user)
  }
  return plan
}

function skipReason(action: BulkAction, user: WorkspaceUser, selfIdentityId: string | undefined): SkipReason | null {
  if (user.identityId === selfIdentityId) return 'self'
  if (user.status === 'disabled') return 'deactivated'
  switch (action) {
    case 'mfa-on':
      if (user.mfaAvailable === false) return 'sso'
      return user.mfaEnabled ? 'already' : null
    case 'mfa-off':
      if (user.mfaAvailable === false) return 'sso'
      return user.mfaEnabled ? null : 'already'
    case 'suspend':
      return user.status === 'active' ? null : 'already'
    case 'restore':
      return user.status === 'suspended' ? null : 'already'
  }
}

// "2 skipped (you, single sign-on)" -- each distinct reason once, in order.
export function skippedSummary(skipped: BulkPlan['skipped']): string {
  if (skipped.length === 0) return ''
  const reasons = [...new Set(skipped.map((s) => SKIP_LABEL[s.reason]))]
  return `${skipped.length} skipped (${reasons.join(', ')})`
}

// Folds the server's per-member results into the same shape a loop of single
// calls produces. Anything the server skipped or failed that the page did not
// already filter out is reported as a failure by name.
export function mfaOutcome(results: MfaChangeResult[], targets: WorkspaceUser[]): BulkOutcome {
  const byId = new Map(targets.map((u) => [u.id, u]))
  const outcome: BulkOutcome = { done: 0, failed: [] }
  for (const r of results) {
    if (r.status === 'changed' || r.status === 'unchanged') {
      outcome.done += 1
      continue
    }
    const user = byId.get(r.userId)
    outcome.failed.push({
      name: user ? displayName(user) : 'A user',
      message: r.status === 'skipped' ? `skipped (${r.reason ?? 'not applicable'})` : "couldn't be changed",
    })
  }
  return outcome
}

export interface BulkMessage {
  tone: 'success' | 'warning'
  title: string
  description?: string
}

// The toast shown when a bulk action finishes.
export function bulkMessage(action: BulkAction, plan: BulkPlan, outcome: BulkOutcome): BulkMessage {
  const lines = [skippedSummary(plan.skipped), ...outcome.failed.map((f) => `${f.name}: ${f.message}`)].filter(Boolean)
  const description = lines.length ? lines.join('\n') : undefined
  if (outcome.failed.length === 0) {
    return { tone: 'success', title: `${DONE_LABEL[action]} for ${plural(outcome.done, 'user', 'users')}`, description }
  }
  const title =
    outcome.done > 0
      ? `${DONE_LABEL[action]} for ${outcome.done} of ${outcome.done + outcome.failed.length}`
      : "Nothing was changed"
  return { tone: 'warning', title, description }
}

// What the confirm panel asks, before anything happens.
export function confirmText(action: BulkAction, count: number): string {
  const who = plural(count, 'user', 'users')
  switch (action) {
    case 'mfa-on':
      return `Turn on two-step verification for ${who}? Their next sign-in will ask for a code emailed to them, and they'll get a notice.`
    case 'mfa-off':
      return `Turn off two-step verification for ${who}? They'll sign in with just a password, and they'll get a notice.`
    case 'suspend':
      return `Suspend access for ${who}? They will be signed out and can't sign in until restored.`
    case 'restore':
      return `Restore access for ${who}?`
  }
}
