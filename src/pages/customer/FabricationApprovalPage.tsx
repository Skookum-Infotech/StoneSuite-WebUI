import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFabricationAction } from '@/hooks/useFabricationAction';
import { fabricationTemplateService } from '@/services/fabricationTemplateService';
import { FabricationTemplateReview } from '@/pages/sales/components/FabricationTemplateReview';
import { useAuthStore } from '@/store/useAuthStore';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote, Spinner } from '@/components/tenant/ui';

export default function FabricationApprovalPage() {
  const { job = '', revision = '' } = useParams();
  const customer = useAuthStore((state) => state.kind === 'portal');
  const client = useQueryClient();
  const [acknowledged, setAcknowledged] = useState(false);
  const key = ['customer-fabrication-template', job, revision];
  const query = useQuery({ queryKey: key, queryFn: () => fabricationTemplateService.customerView(job, revision), enabled: customer && Boolean(job && revision), retry: false });
  const approve = useFabricationAction({
    version: query.data?.jobVersion ?? 0,
    execute: (meta) => fabricationTemplateService.customerApprove(job, revision, meta),
    onSuccess: () => { toast.success('Your template approval has been recorded.'); void client.invalidateQueries({ queryKey: key }); },
  });
  if (!customer) return <div className="p-6"><ErrorNote>Sign in with your customer account to review this template.</ErrorNote></div>;
  if (query.isPending) return <div className="p-6"><Spinner label="Loading your template…" /></div>;
  if (!query.data) return <div className="p-6"><ErrorNote>{apiErrorMessage(query.error, 'This template is not available.')}</ErrorNote></div>;
  const template = query.data;
  return <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-10">
    <header><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Your project</p><h1 className="mt-2 text-2xl font-semibold text-stone-950">Review your measured template</h1><p className="mt-2 text-sm text-stone-600">Check the measured pieces and any changes to your order before approving.</p></header>
    <FabricationTemplateReview revision={template} />
    {template.state === 'approved' || approve.isSuccess ? <div role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-5 text-emerald-800"><CheckCircle2 className="size-5" aria-hidden="true" />Your approval is recorded for this revision.</div> : <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
      <label className="flex items-start gap-3 text-sm text-stone-700"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1 size-4" /><span>I have reviewed these measurements and order changes, and approve revision {template.revision}.</span></label>
      {approve.isError && <p role="alert" className="text-sm text-red-700">{apiErrorMessage(approve.error, 'Approval could not be recorded. Your selection is preserved.')}</p>}
      <button type="button" aria-label={`Approve template revision ${template.revision}`} disabled={!acknowledged || approve.isPending} onClick={() => approve.run({})} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-stone-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">{approve.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Approve this revision</button>
    </section>}
  </main>;
}
