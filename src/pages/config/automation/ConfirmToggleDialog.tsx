import { AlertDialog } from 'radix-ui';
import {
  DISABLE_CONFIRM_BODY,
  disableConfirmTitle,
  enableConfirmBody,
  enableConfirmTitle,
} from '@/lib/automationCopy';
import type { AutomationRule } from '@/types/automationRule';

interface Props {
  /** The rule being toggled; it is being turned on when it is currently off. */
  rule: AutomationRule;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Offered when enabling a rule that has a dry run, so admins can check who is emailed first. */
  onPreview?: () => void;
}

/** Focus-trapping confirmation before a rule is turned on or off. */
export function ConfirmToggleDialog({ rule, pending, onConfirm, onCancel, onPreview }: Props) {
  const enabling = !rule.enabled;
  const title = enabling ? enableConfirmTitle(rule.name) : disableConfirmTitle(rule.name);
  const body = enabling ? enableConfirmBody(rule.ruleKey) : DISABLE_CONFIRM_BODY;
  return (
    <AlertDialog.Root open onOpenChange={(open) => !open && !pending && onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-[2px]" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[10000] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl dark:bg-stone-900">
          <AlertDialog.Title className="text-sm font-bold text-stone-900 dark:text-white">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-xs text-stone-600 dark:text-stone-300">
            {body}
          </AlertDialog.Description>
          {enabling && rule.previewSupported && onPreview && (
            <button
              type="button"
              onClick={onPreview}
              aria-label="Preview who will be emailed"
              className="mt-3 text-xs font-semibold text-brand-dark underline-offset-2 hover:underline"
            >
              Preview who will be emailed
            </button>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                disabled={pending}
                aria-label="Cancel"
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </AlertDialog.Cancel>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              aria-label={enabling ? 'Turn on' : 'Turn off'}
              className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {enabling ? 'Turn on' : 'Turn off'}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
