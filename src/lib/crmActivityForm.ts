import type { ActivityType } from '@/services/crmActivityService'

// Mirrors crmactivity.ValidTypes (StoneSuite-Backend) — the
// chk_crm_activity_type CHECK constraint. Single source of truth for the
// filter chips and the Log Activity dialog's type selector.
export const ACTIVITY_TYPES: readonly ActivityType[] = ['call', 'email', 'meeting', 'note', 'task']

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  note: 'Note',
  task: 'Task',
}

/**
 * Converts an `<input type="datetime-local">` value (local wall-clock time,
 * no timezone) to the RFC3339 UTC instant the backend expects. A blank
 * value returns undefined so the server defaults occurredAt to now.
 */
export function toOccurredAtPayload(datetimeLocalValue: string): string | undefined {
  if (!datetimeLocalValue) return undefined
  return new Date(datetimeLocalValue).toISOString()
}

/**
 * Converts an Activity.occurredAt ISO instant back to a datetime-local
 * input value (local wall-clock time), for pre-filling the edit form.
 */
export function fromOccurredAtIso(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
