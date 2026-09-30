import { RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { JOB_STATUS_COLOR } from '@/lib/tenantDisplay';
import { Badge, Spinner, ErrorNote } from '@/components/tenant/ui';
import type { AsyncJob, Tenant } from '@/types/tenant';

// Polling cadence while a job is still pending/running (ADR-1: lightweight
// polling instead of WebSockets at current scale).
const JOB_POLL_INTERVAL_MS = 3000;

export function TenantJobsPanel({ tenant }: { tenant: Tenant }) {
  const qc = useQueryClient();

  const jobsQ = useQuery({
    queryKey: ['jobs', tenant.id],
    queryFn: () => platformService.listJobs(tenant.id),
    refetchInterval: (query) => {
      const jobs = query.state.data ?? [];
      const active = jobs.some((j) => j.status === 'pending' || j.status === 'running');
      return active ? JOB_POLL_INTERVAL_MS : false;
    },
  });

  const retry = useMutation({
    mutationFn: (jobId: string) => platformService.retryJob(tenant.id, jobId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs', tenant.id] }),
  });

  const jobs = jobsQ.data ?? [];
  // Hide the panel entirely for tenants with no recorded jobs (e.g. ones
  // provisioned before the durable job queue existed) to avoid clutter.
  if (!jobsQ.isLoading && jobs.length === 0) return null;

  return (
    <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-3">
      <h3 className="mb-2 text-xs font-bold text-stone-600">Provisioning jobs</h3>
      {jobsQ.isLoading && <Spinner label="Loading jobs…" />}
      {jobsQ.isError && <ErrorNote>{apiErrorMessage(jobsQ.error, 'Failed to load jobs.')}</ErrorNote>}
      {retry.error && (
        <div className="mb-2">
          <ErrorNote>{apiErrorMessage(retry.error, 'Failed to retry job.')}</ErrorNote>
        </div>
      )}

      <div className="space-y-2">
        {jobs.map((j) => (
          <JobRow key={j.id} job={j} onRetry={() => retry.mutate(j.id)} retrying={retry.isPending} />
        ))}
      </div>
    </div>
  );
}

function JobRow({ job, onRetry, retrying }: { job: AsyncJob; onRetry: () => void; retrying: boolean }) {
  const canRetry = job.status === 'failed' || job.status === 'dead';
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-stone-700">{job.jobType}</span>
        <Badge color={JOB_STATUS_COLOR[job.status]}>{job.status}</Badge>
      </div>
      {job.progress?.step && <p className="mt-1 text-2xs text-stone-400">Step: {job.progress.step}</p>}
      {job.lastError && <p className="mt-1 text-2xs text-red-500">{job.lastError}</p>}
      <p className="mt-1 text-2xs text-stone-400">
        Attempt {job.attempts}/{job.maxAttempts} · updated {new Date(job.updatedAt).toLocaleString()}
      </p>
      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          aria-label={`Retry ${job.jobType} job`}
          className="mt-2 inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-label font-semibold text-stone-950 disabled:opacity-50"
        >
          <RefreshCw className={`size-3 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      )}
    </div>
  );
}
