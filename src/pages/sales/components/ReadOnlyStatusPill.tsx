import { StatusPill } from '@/components/ui/StatusPill';

// Non-interactive twin of StatusSelect's 'pill' trigger — same dot, tint and
// sizing, minus the button and chevron. A List row shows this instead of the
// status dropdown to anyone who may not change status from the list, so the
// column keeps its look without offering a control.
export function ReadOnlyStatusPill({ label, color }: { label: string; color?: string }) {
  return <StatusPill color={color}>{label}</StatusPill>;
}
