import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useFabricationAction } from '@/hooks/useFabricationAction';
import { fabricationTemplateService } from '@/services/fabricationTemplateService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { TemplateRevision } from '@/types/fabricationTemplates';

export function FabricationCustomerEvidence({ jobId, revision }: { jobId: string; revision: TemplateRevision }) {
  const client = useQueryClient();
  const [approver, setApprover] = useState('');
  const [channel, setChannel] = useState('email');
  const [date, setDate] = useState('');
  const [evidence, setEvidence] = useState('');
  const action = useFabricationAction({
    version: revision.jobVersion,
    execute: (meta, input: { approver: string; channel: string; approvedAt: string; evidence: string }) => fabricationTemplateService.recordCustomer(jobId, revision.id, { ...meta, ...input }),
    onSuccess: () => { toast.success('Customer approval evidence recorded.'); void client.invalidateQueries({ queryKey: ['fabrication-templates', jobId] }); void client.invalidateQueries({ queryKey: ['fabrication-job', jobId] }); },
  });
  const field = 'mt-1 min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm';
  return <details className="rounded-xl border border-stone-200 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold text-stone-800">Record approval received outside the app</summary><form className="mt-4 space-y-4" onSubmit={(event) => { event.preventDefault(); action.run({ approver, channel, evidence, approvedAt: new Date(date).toISOString() }); }}>
    <p className="text-sm text-stone-500">Record who approved revision {revision.revision} and where the approval is saved. Your identity is recorded separately.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium">Customer approver<input required value={approver} onChange={(event) => setApprover(event.target.value)} className={field} /></label>
      <label className="text-sm font-medium">Approval received<input required type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} className={field} /></label>
      <label className="text-sm font-medium">Evidence channel<select value={channel} onChange={(event) => setChannel(event.target.value)} className={field}><option value="email">Email</option><option value="signed_document">Signed document</option><option value="message">Message</option></select></label>
    </div>
    <label className="block text-sm font-medium">Evidence reference<textarea required value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Identify the saved email, signed document or message." className={field} /></label>
    {action.isError && <p role="alert" className="text-sm text-red-700">{apiErrorMessage(action.error, 'Customer approval could not be recorded.')}</p>}
    <button type="submit" disabled={action.isPending} className="min-h-11 rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Record customer approval</button>
  </form></details>;
}
