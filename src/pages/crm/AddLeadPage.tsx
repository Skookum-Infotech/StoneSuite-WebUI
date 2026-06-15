import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Sparkles, AlertCircle, Loader2, Building2,
  Save, X,
} from 'lucide-react';
import { crmService } from '@/services/crmService';
import { workflowService, userService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { CrmRecordForm } from '@/components/crm/CrmRecordForm';
import { crmCoreDefaults } from '@/lib/crmFields';
import type { FieldDefinition } from '@/types/tenant';

export default function AddLeadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [coreFields, setCoreFields] = useState<Record<string, unknown>>(crmCoreDefaults);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [ownerUserId, setOwnerUserId] = useState('');

  const set = (key: string, value: unknown) => setCoreFields((d) => ({ ...d, [key]: value }));

  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const leadWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'lead');
  const { data: leadDef } = useQuery({
    queryKey: ['workflow', leadWorkflow?.id],
    queryFn: () => workflowService.get(leadWorkflow!.id),
    enabled: Boolean(leadWorkflow?.id),
  });
  const customFieldDefs: FieldDefinition[] = leadDef?.fields ?? [];

  const { data: users = [] } = useQuery({ queryKey: ['workspace-users'], queryFn: userService.listUsers });

  const { mutate: createLead, isPending, error: createError } = useMutation({
    mutationFn: () =>
      crmService.createRecord('lead', {
        coreFields,
        customFields: customFieldValues,
        ownerUserId: ownerUserId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'lead'] });
      navigate('/crm/lead');
    },
  });

  const displayName =
    String(coreFields.company_name ?? '') ||
    [coreFields.first_name, coreFields.last_name].filter(Boolean).join(' ');

  return (
    <div className="flex flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); createLead(); }}
        className="flex flex-1 min-h-0 min-w-0"
      >
        {/* ── Left: scrollable form ── */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">

          {/* Page title */}
          <div className="shrink-0 bg-white border-b border-stone-100 px-6 py-3.5 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-stone-800 leading-tight">New Lead</h1>
              <p className="text-2xs text-stone-400 mt-0.5">Fill in the details to create a lead record</p>
            </div>
          </div>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto modal-scrollbar px-6 py-5 space-y-4">
            <CrmRecordForm
              core={{ fields: coreFields, onChange: set }}
              custom={{ defs: customFieldDefs, values: customFieldValues, onChange: (key, value) => setCustomFieldValues((prev) => ({ ...prev, [key]: value })) }}
              owner={{ userId: ownerUserId, onChange: setOwnerUserId, users }}
            />

            <div className="h-4" />
          </div>
        </div>

        {/* ── Right: sticky actions panel ── */}
        <div className="w-60 xl:w-64 shrink-0 border-l border-stone-200 bg-white flex flex-col overflow-y-auto modal-scrollbar">

          {/* Save / Cancel */}
          <div className="p-4 border-b border-stone-100 space-y-2">
            <button
              type="submit"
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all duration-150 shadow-sm hover:shadow"
            >
              {isPending ? (
                <><Loader2 className="size-3.5 animate-spin" />Saving…</>
              ) : (
                <><Save className="size-3.5" />Save Lead</>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/crm/lead')}
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 hover:border-stone-300 disabled:opacity-50 transition-all duration-150"
            >
              <X className="size-3.5" />
              Cancel
            </button>

            {createError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                <span>{apiErrorMessage(createError, 'Failed to save lead.')}</span>
              </div>
            )}
          </div>

          {/* Record preview */}
          <div className="p-4 border-b border-stone-100">
            <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5">Preview</p>
            <div className="rounded-lg bg-stone-50 border border-stone-100 p-3 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                  <Building2 className="h-3.5 w-3.5 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-stone-800 truncate leading-tight">
                    {displayName || <span className="text-stone-400 font-normal italic">Unnamed</span>}
                  </p>
                  <p className="text-2xs text-stone-400 mt-0.5">Lead</p>
                </div>
              </div>
              {(Boolean(coreFields.email) || Boolean(coreFields.phone)) && (
                <div className="pt-2 space-y-1 border-t border-stone-200">
                  {Boolean(coreFields.email) && (
                    <p className="text-2xs text-stone-500 truncate">{String(coreFields.email)}</p>
                  )}
                  {Boolean(coreFields.phone) && (
                    <p className="text-2xs text-stone-500 truncate">{String(coreFields.phone)}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tip */}
          <div className="p-4 mt-auto">
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
              <p className="text-2xs font-semibold text-amber-700 mb-1">Tip</p>
              <p className="text-2xs text-amber-600 leading-relaxed">
                Fields marked <span className="text-red-400 font-semibold">*</span> are required. A company name or contact person must be set before saving.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
