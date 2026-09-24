import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/api/tenantClient';
import { PageHeader, Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { Switch } from '@/components/ui/switch';
import { getPlatformAISettings, setPlatformAIEnabled } from '@/services/aiService';
import type { OllamaState, PlatformAISettings } from '@/types/ai';

const OLLAMA_STATE_LABEL: Record<OllamaState, string> = {
  started: 'Running',
  stopped: 'Stopped',
  mixed: 'Partially running',
  unknown: 'Unknown',
};

/** Human-readable local timestamp, matching lib/feedback.ts's
 *  formatFeedbackTime / lib/auditLog.ts's formatAuditTime convention. Falls
 *  back to an em dash for a null/absent value (never synced, never changed). */
function formatPlatformTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Platform-admin master switch — the other half of the assistant's two-switch
// design (see config/ai-assistant/AIAssistantConfigPage for the tenant half).
// Turning this off stops the shared self-hosted Ollama server, so it gets a
// confirm step; turning it on does not.
export default function PlatformAIPage() {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const settingsQ = useQuery({
    queryKey: ['platform-ai-settings'],
    queryFn: getPlatformAISettings,
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setPlatformAIEnabled(enabled),
    onSuccess: (settings: PlatformAISettings) => {
      qc.setQueryData(['platform-ai-settings'], settings);
      // Every tenant's ['ai-status'] (Help menu, tenant config toggle) is now
      // stale — refresh it instead of waiting out its own staleTime.
      void qc.invalidateQueries({ queryKey: ['ai-status'] });
      toast.success(
        settings.enabled
          ? 'StoneSuite Assistant enabled for all organizations.'
          : 'StoneSuite Assistant disabled for all organizations.',
      );
    },
  });

  const settings = settingsQ.data;

  function handleToggle(checked: boolean): void {
    if (checked) {
      toggle.mutate(true);
    } else {
      setConfirmOpen(true);
    }
  }

  function confirmDisable(): void {
    setConfirmOpen(false);
    toggle.mutate(false);
  }

  const stateLabel = OLLAMA_STATE_LABEL[settings?.ollamaState ?? 'unknown'];

  return (
    <div className="p-6 3xl:p-10 4xl:p-14">
      <PageHeader
        title="AI Assistant"
        subtitle="The master switch for the StoneSuite Assistant across every organization."
      />

      <section className="max-w-2xl rounded-[10px] border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
        <div className="mb-4 flex items-start gap-3 border-b border-stone-100 pb-4 dark:border-stone-800">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand-dark">
            <Sparkles className="size-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-950 dark:text-white">What this controls</h2>
            <p className="mt-1 text-xs text-stone-500">
              Turning this off stops the self-hosted AI server and hides the assistant for every organization,
              regardless of that organization&apos;s own setting. Turning it back on restarts the server and
              restores access for every organization that has it enabled.
            </p>
          </div>
        </div>

        {settingsQ.isLoading ? (
          <Spinner label="Loading assistant settings…" />
        ) : settingsQ.error ? (
          <ErrorNote>{apiErrorMessage(settingsQ.error, 'Failed to load the assistant setting.')}</ErrorNote>
        ) : (
          <>
            <label className="flex items-center justify-between gap-3 select-none">
              <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                StoneSuite Assistant (all organizations)
              </span>
              <Switch
                checked={settings?.enabled ?? false}
                onCheckedChange={handleToggle}
                disabled={toggle.isPending}
                aria-label="StoneSuite Assistant (all organizations)"
              />
            </label>

            {toggle.error && (
              <div className="mt-3">
                <ErrorNote>{apiErrorMessage(toggle.error, 'Failed to update the assistant setting.')}</ErrorNote>
              </div>
            )}

            <dl className="mt-5 grid gap-3 border-t border-stone-100 pt-4 text-xs dark:border-stone-800 sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-stone-500">AI server</dt>
                <dd className="mt-0.5">
                  <Badge size="sm">{stateLabel}</Badge>
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-500">Help content last synced</dt>
                <dd className="mt-0.5 text-stone-700 dark:text-stone-300">
                  {formatPlatformTimestamp(settings?.helpCorpusSyncedAt)}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-500">Last changed</dt>
                <dd className="mt-0.5 text-stone-700 dark:text-stone-300">
                  {formatPlatformTimestamp(settings?.updatedAt)}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-500">Last changed by</dt>
                <dd className="mt-0.5 text-stone-700 dark:text-stone-300">{settings?.updatedBy || '—'}</dd>
              </div>
            </dl>

            {settings?.leaseHolders && settings.leaseHolders.length > 0 && (
              <p className="mt-3 text-2xs text-stone-500">Also in use by: {settings.leaseHolders.join(', ')}</p>
            )}
          </>
        )}
      </section>

      {confirmOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="disable-ai-dialog-title"
            onClick={(e) => e.target === e.currentTarget && setConfirmOpen(false)}
          >
            <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl dark:bg-stone-900">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="size-4 text-destructive" />
                </div>
                <div>
                  <h3 id="disable-ai-dialog-title" className="text-sm font-bold text-stone-900 dark:text-white">
                    Turn off the StoneSuite Assistant?
                  </h3>
                  <p className="mt-0.5 text-xs text-stone-400">
                    This stops the AI server and disables the assistant for every organization.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={toggle.isPending}
                  className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDisable}
                  disabled={toggle.isPending}
                  className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
                >
                  {toggle.isPending ? 'Turning off…' : 'Turn off for everyone'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
