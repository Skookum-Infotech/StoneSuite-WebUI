import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fabricationTemplateService } from '@/services/fabricationTemplateService';
import { useFabricationAction } from '@/hooks/useFabricationAction';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import { FabricationCustomerEvidence } from './FabricationCustomerEvidence';
import { FabricationTemplateReview } from './FabricationTemplateReview';
import type { TemplateRevision } from '@/types/fabricationTemplates';

export function FabricationTemplatesPanel({ jobId }: { jobId: string }) {
  const query = useQuery({ queryKey: ['fabrication-templates', jobId], queryFn: () => fabricationTemplateService.list(jobId) });
  if (query.isPending) return <Spinner label="Loading template revisions…" />;
  if (query.isError) return <ErrorNote>{apiErrorMessage(query.error, 'Template revisions could not be loaded.')}</ErrorNote>;
  if (!query.data.length) return <section className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center"><h3 className="font-semibold text-stone-900">Measurements come first</h3><p className="mt-2 text-sm text-stone-500">No template has been submitted for review yet.</p></section>;
  return <div className="space-y-5">{query.data.map((revision) => <div key={revision.id} className="space-y-3"><FabricationTemplateReview revision={revision} />{revision.state === 'submitted' && <TemplateDecisions jobId={jobId} revision={revision} />}</div>)}</div>;
}

function TemplateDecisions({ jobId, revision }: { jobId: string; revision: TemplateRevision }) {
  const client = useQueryClient();
  const [reason, setReason] = useState('');
  const actions = revision.availableActions ?? [];
  const decision = useFabricationAction({
    version: revision.jobVersion,
    execute: (meta, input: { approve: boolean; reason: string }) => fabricationTemplateService.decide(jobId, revision.id, { ...meta, ...input }),
    onSuccess: () => { toast.success('Template decision recorded.'); void client.invalidateQueries({ queryKey: ['fabrication-templates', jobId] }); void client.invalidateQueries({ queryKey: ['fabrication-job', jobId] }); },
  });
  const canApprove = actions.some((action) => action.code === 'approve_revision' && action.enabled);
  const canReject = actions.some((action) => action.code === 'reject_revision' && action.enabled);
  return <section aria-label="Template decisions" className="space-y-3 rounded-xl border border-stone-200 bg-white p-5">
    {canApprove && <button type="button" aria-label="Approve template" disabled={decision.isPending} onClick={() => decision.run({ approve: true, reason: '' })} className="min-h-11 rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Approve template</button>}
    {canReject && <div className="space-y-2"><label className="block text-sm font-medium text-stone-700">Changes needed<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 block min-h-20 w-full rounded-lg border border-stone-200 p-3 text-sm" /></label><button type="button" aria-label="Request template changes" disabled={!reason.trim() || decision.isPending} onClick={() => decision.run({ approve: false, reason })} className="min-h-11 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Request changes</button></div>}
    {decision.isError && <p role="alert" className="text-sm text-red-700">{apiErrorMessage(decision.error, 'Decision could not be saved. Your input has been preserved.')}</p>}
    {actions.some((action) => action.code === 'share_customer_review' && action.enabled) && <p className="text-sm text-stone-600">Customer review: <a className="font-medium underline" href={`/customer/fabrication-approvals/${jobId}/${revision.id}`}>Open approval page</a></p>}
    {actions.some((action) => action.code === 'record_customer_approval' && action.enabled) && <FabricationCustomerEvidence jobId={jobId} revision={revision} />}
    {!canApprove && !canReject && <p className="text-sm text-stone-500">Waiting for the required approvals.</p>}
  </section>;
}
