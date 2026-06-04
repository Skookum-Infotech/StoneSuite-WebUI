import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil } from 'lucide-react';
import { prospectService } from '@/services/prospectService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ProspectDetails } from '@/components/prospect/ProspectDetails';

export default function ProspectViewPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const prospectQ = useQuery({
    queryKey: ['prospect', id],
    queryFn: () => prospectService.get(id),
    enabled: Boolean(id),
  });

  const prospect = prospectQ.data;

  // Spread the Prospect into a flat Record so ProspectDetails can read any
  // field by key. Numeric nulls become '' so the component shows "—".
  const fields: Record<string, unknown> = prospect
    ? Object.fromEntries(
        Object.entries(prospect).map(([k, v]) => [k, v === null ? '' : v]),
      )
    : {};

  return (
    <div className="flex-1 bg-stone-50 p-6">
      <button
        type="button"
        onClick={() => navigate('/prospects')}
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800"
      >
        <ArrowLeft className="size-3.5" /> Prospects
      </button>

      {prospectQ.isLoading && <Spinner label="Loading prospect…" />}
      {prospectQ.isError && (
        <ErrorNote>{apiErrorMessage(prospectQ.error, 'Failed to load prospect.')}</ErrorNote>
      )}

      {prospect && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-bold text-stone-900">
                {prospect.company_name || '(unnamed prospect)'}
              </h1>
              {prospect.status && <Badge>{prospect.status}</Badge>}
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] text-stone-400">
              <Pencil className="size-3" />
              Created {prospect.created_at ? new Date(prospect.created_at).toLocaleDateString() : '—'}
            </span>
          </div>

          <ProspectDetails fields={fields} />
        </>
      )}
    </div>
  );
}
