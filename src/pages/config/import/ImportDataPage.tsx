import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { PageHeader, Spinner, EmptyState, ErrorNote } from '@/components/tenant/ui';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { workflowService } from '@/services/tenantServices';
import { importService } from '@/services/importService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { ImportSummary } from '@/types/import';
import { ImportUploadStep } from './ImportUploadStep';
import { ImportReviewStep } from './ImportReviewStep';

// No separate 'review' state: once staging finishes (job.status ===
// 'succeeded'), the 'staging' step's own render just switches from the
// polling spinner to ImportReviewStep — derived from live query data rather
// than an effect-driven transition, so there's no extra render/state to keep
// in sync.
type Step = 'upload' | 'staging' | 'done';

function humanizeKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ImportDataPage() {
  const { workflows: enabledWorkflows, isLoading: enabledLoading } = useWorkflows();
  const { hasPermission, isLoading: permsLoading } = useUserPermissions();

  // Full workflow list (id + name), gated by workflow:read — used only to
  // resolve a key to its id (for field-definition lookup) and for a nicer
  // display name. A caller without workflow:read can still import (RBAC on
  // the import endpoints themselves is per-workflow create/update, not
  // workflow:read); they just see the raw key as the label and no
  // custom-field mapping suggestions.
  const workflowsQuery = useQuery({
    queryKey: ['workflows'],
    queryFn: workflowService.list,
    retry: false,
  });

  const importableKeys = useMemo(
    () => enabledWorkflows.filter((w) => w.enabled && hasPermission(w.key, 'create')).map((w) => w.key),
    [enabledWorkflows, hasPermission],
  );

  const [selectedKey, setSelectedKey] = useState<string>('');
  const workflowKey = selectedKey || importableKeys[0] || '';

  const workflowMeta = workflowsQuery.data?.find((w) => w.key === workflowKey);
  const fieldDefsQuery = useQuery({
    queryKey: ['workflow-def', workflowMeta?.id],
    queryFn: () => workflowService.get(workflowMeta?.id ?? ''),
    enabled: Boolean(workflowMeta?.id),
  });

  const [step, setStep] = useState<Step>('upload');
  const [jobId, setJobId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const jobQuery = useQuery({
    queryKey: ['import-job', jobId],
    queryFn: () => importService.getJob(jobId ?? ''),
    enabled: Boolean(jobId) && step === 'staging',
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'succeeded' || status === 'failed' ? false : 1500;
    },
  });

  const job = jobQuery.data;
  const showReview = step === 'staging' && job?.status === 'succeeded';

  const reset = () => {
    setStep('upload');
    setJobId(null);
    setSummary(null);
  };

  const isLoading = enabledLoading || permsLoading;

  return (
    <div className="p-6 3xl:p-10 4xl:p-14">
      <PageHeader
        title="Import Data"
        subtitle="Upload a CSV, XLSX, DOCX, or PDF to stage candidate records for review before they're created."
      />

      {isLoading ? (
        <Spinner label="Loading workflows…" />
      ) : importableKeys.length === 0 ? (
        <EmptyState>
          You don&apos;t have create access to any importable record type. Ask an administrator to grant you
          access to the workflow you want to import into.
        </EmptyState>
      ) : (
        <div className="max-w-4xl space-y-6">
          <div className="flex items-center gap-3">
            <label htmlFor="import-workflow" className="text-xs font-semibold text-stone-600 dark:text-stone-300">
              Import into
            </label>
            <select
              id="import-workflow"
              value={workflowKey}
              disabled={step !== 'upload'}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 outline-none focus:border-brand disabled:opacity-60 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
            >
              {importableKeys.map((key) => (
                <option key={key} value={key}>
                  {workflowsQuery.data?.find((w) => w.key === key)?.name ?? humanizeKey(key)}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
            {step === 'upload' && (
              <ImportUploadStep
                workflowKey={workflowKey}
                onStaged={(newJobId) => {
                  setJobId(newJobId);
                  setStep('staging');
                }}
              />
            )}

            {step === 'staging' && !showReview && (
              <div className="space-y-3">
                <Spinner
                  label={
                    job?.status === 'failed'
                      ? 'Import failed'
                      : job?.progress?.total
                        ? `Staging rows… ${job.progress.staged ?? 0} / ${job.progress.total}`
                        : 'Parsing your file…'
                  }
                />
                {job?.status === 'failed' && (
                  <>
                    <ErrorNote>{job.lastError ?? 'The import job failed.'}</ErrorNote>
                    <button
                      type="button"
                      onClick={reset}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-white/5"
                    >
                      <RotateCcw className="size-3.5" /> Try again
                    </button>
                  </>
                )}
              </div>
            )}

            {showReview && jobId && (
              <ImportReviewStep
                jobId={jobId}
                workflowKey={workflowKey}
                fieldDefs={fieldDefsQuery.data?.fields ?? []}
                onCommitted={(s) => {
                  setSummary(s);
                  setStep('done');
                }}
              />
            )}

            {step === 'done' && summary && (
              <div className="space-y-4 text-center">
                <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
                <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">Import complete</p>
                <p className="text-xs text-stone-500">
                  {summary.committed} committed · {summary.skipped} skipped · {summary.failed} failed
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-dark"
                >
                  Import another file
                </button>
              </div>
            )}
          </div>

          {workflowsQuery.isError && (
            <p className="text-2xs text-stone-400">
              {apiErrorMessage(
                workflowsQuery.error,
                'Custom-field mapping suggestions are unavailable — you can still import using core fields.',
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
