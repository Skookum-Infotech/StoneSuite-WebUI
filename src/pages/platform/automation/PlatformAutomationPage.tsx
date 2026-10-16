import { useRef, useState } from 'react';
import { AlertDialog } from 'radix-ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/api/tenantClient';
import { PageHeader, Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { Switch } from '@/components/ui/switch';
import { getPlatformAutomation, setPlatformAutomationEnabled } from '@/services/platformAutomationService';
import type { PlatformAutomationSettings } from '@/types/ai';

const QUERY_KEY = ['platform-automation'];
const SWITCH_LABEL = 'Automation scheduler (all organizations)';

/** Local timestamp; an em dash when the switch has never been changed. */
function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Platform-admin master switch for the 15-minute automation scheduler. Off by
// default: every scheduler run wakes the backend and database, which costs
// money, so turning it ON asks for confirmation; turning it off does not.
export default function PlatformAutomationPage() {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const switchRef = useRef<HTMLButtonElement>(null);

  const settingsQ = useQuery({ queryKey: QUERY_KEY, queryFn: getPlatformAutomation });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setPlatformAutomationEnabled(enabled),
    onSuccess: (settings: PlatformAutomationSettings) => {
      qc.setQueryData(QUERY_KEY, settings);
      if (settings.kvSynced === false) {
        toast.warning('Saved, but the scheduler may not reflect it yet. Retry to re-sync.');
      } else {
        toast.success(settings.enabled ? 'Automation scheduler turned on.' : 'Automation scheduler turned off.');
      }
    },
    onSettled: () => setConfirmOpen(false),
  });

  const settings = settingsQ.data;
  const needsResync = settings?.kvSynced === false;

  function handleToggle(checked: boolean): void {
    if (checked) setConfirmOpen(true);
    else toggle.mutate(false);
  }

  return (
    <div className="p-6 3xl:p-10 4xl:p-14">
      <PageHeader
        title="Automation"
        subtitle="The master switch for scheduled automation across every organization."
      />

      <section className="max-w-2xl rounded-[10px] border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
        <div className="mb-4 flex items-start gap-3 border-b border-stone-100 pb-4 dark:border-stone-800">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand-dark">
            <Timer className="size-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-950 dark:text-white">What this controls</h2>
            <p className="mt-1 text-xs text-stone-500">
              {settings?.message ??
                'Controls the 15-minute scheduler for all organizations, including scheduled vendor-payment dispatch.'}{' '}
              While off, nothing runs and the servers are not woken up, so it adds no cost. It is off by default.
            </p>
          </div>
        </div>

        {settingsQ.isLoading ? (
          <Spinner label="Loading automation settings…" />
        ) : settingsQ.error ? (
          <ErrorNote>{apiErrorMessage(settingsQ.error, 'Failed to load the automation setting.')}</ErrorNote>
        ) : (
          <>
            <label className="flex items-center justify-between gap-3 select-none">
              <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">{SWITCH_LABEL}</span>
              <Switch
                checked={settings?.enabled ?? false}
                ref={switchRef}
                onCheckedChange={handleToggle}
                disabled={toggle.isPending}
                aria-label={SWITCH_LABEL}
              />
            </label>

            {toggle.error && (
              <div className="mt-3">
                <ErrorNote>{apiErrorMessage(toggle.error, 'Failed to update the automation setting.')}</ErrorNote>
              </div>
            )}

            {needsResync && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <span>Saved, but syncing to the scheduler failed. It may not reflect this yet.</span>
                <button
                  type="button"
                  onClick={() => toggle.mutate(settings?.enabled ?? false)}
                  disabled={toggle.isPending}
                  className="shrink-0 rounded-lg border border-amber-300 px-3 py-1.5 font-semibold hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:hover:bg-amber-900/40"
                >
                  Retry sync
                </button>
              </div>
            )}

            <dl className="mt-5 grid gap-3 border-t border-stone-100 pt-4 text-xs dark:border-stone-800 sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-stone-500">Status</dt>
                <dd className="mt-0.5">
                  <Badge size="sm">{settings?.enabled ? 'On' : 'Off'}</Badge>
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-500">Scheduler sync</dt>
                <dd className="mt-0.5">
                  <Badge size="sm">
                    {!settings?.kvConfigured ? 'Not configured' : needsResync ? 'Out of sync' : 'In sync'}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-500">Last changed</dt>
                <dd className="mt-0.5 text-stone-700 dark:text-stone-300">{formatTimestamp(settings?.updatedAt)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-500">Last changed by</dt>
                <dd className="mt-0.5 text-stone-700 dark:text-stone-300">{settings?.updatedBy || '—'}</dd>
              </div>
            </dl>
          </>
        )}
      </section>

      <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-[2px]" />
          <AlertDialog.Content
            aria-describedby="enable-automation-dialog-desc"
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              switchRef.current?.focus();
            }}
            className="fixed left-1/2 top-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl dark:bg-stone-900"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="size-4 text-amber-600" aria-hidden="true" />
              </div>
              <div>
                <AlertDialog.Title className="text-sm font-bold text-stone-900 dark:text-white">
                  Turn on the automation scheduler?
                </AlertDialog.Title>
                <AlertDialog.Description id="enable-automation-dialog-desc" className="mt-0.5 text-xs text-stone-500">
                  The scheduler will run every 15 minutes for every organization, waking the servers each time. This
                  increases hosting cost.
                </AlertDialog.Description>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel
                disabled={toggle.isPending}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
              >
                Cancel
              </AlertDialog.Cancel>
              <button
                type="button"
                onClick={() => toggle.mutate(true)}
                disabled={toggle.isPending}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {toggle.isPending ? 'Turning on…' : 'Turn on for everyone'}
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
