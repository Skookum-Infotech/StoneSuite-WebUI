import * as React from 'react';
import { ConfirmLeaveDialog } from '@/components/ConfirmLeaveDialog';
import type { UnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';

interface UnsavedChangesPromptProps {
  guard: UnsavedChangesGuard;
}

/**
 * Renders the discard confirmation for a `useUnsavedChangesGuard`, so each form
 * page wires the guard up in a single line.
 */
export function UnsavedChangesPrompt({ guard }: UnsavedChangesPromptProps): React.JSX.Element | null {
  if (!guard.isPrompting) return null;
  return (
    <ConfirmLeaveDialog
      variant="unsaved-changes"
      onConfirm={guard.confirmLeave}
      onCancel={guard.cancelLeave}
    />
  );
}
