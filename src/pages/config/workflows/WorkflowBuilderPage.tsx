import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { AxiosError } from 'axios';
import { workflowService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader, Spinner, Badge, ErrorNote } from '@/components/tenant/ui';
import type { FieldType, WorkflowState, FieldDefinition } from '@/types/tenant';

// BASE_FIELD_LABELS lists the built-in (hardcoded) form fields for each workflow.
// These are shown read-only in the Config page so admins understand what's already there.
const BASE_FIELD_LABELS: Record<string, { key: string; label: string }[]> = {
  lead: [
    { key: 'type', label: 'Type' },
    { key: 'lead_status', label: 'Lead Status' },
    { key: 'company_name', label: 'Company Name' },
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'fax', label: 'Fax' },
    { key: 'address', label: 'Address' },
    { key: 'sales_rep', label: 'Sales Rep' },
    { key: 'territory', label: 'Territory' },
    { key: 'partner', label: 'Partner' },
    { key: 'primary_subsidiary', label: 'Primary Subsidiary' },
    { key: 'crm_account_owner', label: 'CRM Account Owner' },
    { key: 'customer_type', label: 'Customer Type' },
    { key: 'estimated_budget', label: 'Estimated Budget' },
    { key: 'sales_readiness', label: 'Sales Readiness' },
    { key: 'buying_reason', label: 'Buying Reason' },
    { key: 'buying_time_frame', label: 'Buying Time Frame' },
  ],
  prospect: [
    { key: 'company_name', label: 'Company Name' },
    { key: 'status', label: 'Status' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address' },
    { key: 'customer_type', label: 'Customer Type' },
    { key: 'territory', label: 'Territory' },
    { key: 'estimated_budget', label: 'Estimated Budget' },
    { key: 'credit_limit', label: 'Credit Limit' },
    { key: 'payment_terms', label: 'Payment Terms' },
    { key: 'currency', label: 'Currency' },
    { key: 'tax_id', label: 'Tax ID' },
    { key: 'sales_rep', label: 'Sales Rep' },
    { key: 'primary_contact', label: 'Primary Contact' },
    { key: 'billing_account_name', label: 'Billing Account Name' },
  ],
  customer: [
    { key: 'account_email', label: 'Account Email' },
  ],
};

export default function WorkflowBuilderPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [toggleError, setToggleError] = useState<string | null>(null);

  const { data: def, isLoading, error } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => workflowService.get(id),
    staleTime: 10 * 60 * 1000,
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => workflowService.setEnabled(id, enabled),
    onSuccess: () => {
      setToggleError(null);
      qc.invalidateQueries({ queryKey: ['workflow', id] });
      qc.invalidateQueries({ queryKey: ['workflows'] });
    },
    onError: (err: unknown) => {
      if (err instanceof AxiosError && err.response?.status === 409) {
        setToggleError(err.response.data?.message ?? 'Cannot change workflow status due to a dependency conflict.');
      } else {
        setToggleError(apiErrorMessage(err, 'Failed to update workflow status.'));
      }
    },
  });

  if (isLoading) return <div className="p-6"><Spinner /></div>;
  if (error || !def) return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load workflow.')}</ErrorNote></div>;

  const stateById = new Map<string, WorkflowState>(def.states.map((s) => [s.id, s]));
  const baseFields = BASE_FIELD_LABELS[def.workflow.key.toLowerCase()] ?? [];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Link to="/config/workflows" className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800">
        <ArrowLeft className="size-3.5" /> All forms
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={`Configure: ${def.workflow.name}`}
          subtitle={def.workflow.description || def.workflow.key}
        />
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <Badge color={def.workflow.enabled ? '#22c55e' : '#a8a29e'}>
              {def.workflow.enabled ? 'enabled' : 'disabled'}
            </Badge>
            <button
              type="button"
              aria-label={def.workflow.enabled ? `Disable ${def.workflow.name}` : `Enable ${def.workflow.name}`}
              onClick={() => { setToggleError(null); toggle.mutate(!def.workflow.enabled); }}
              disabled={toggle.isPending}
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:border-stone-700 dark:hover:bg-stone-800"
            >
              {def.workflow.enabled ? 'Disable' : 'Enable'}
            </button>
          </div>
          {toggleError && (
            <div className="max-w-xs">
              <ErrorNote>{toggleError}</ErrorNote>
            </div>
          )}
        </div>
      </div>

      {/* Base fields — read-only */}
      <section className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
        <div className="mb-3">
          <h2 className="text-sm font-bold">Base fields</h2>
          <p className="text-xs text-stone-500">
            Built-in fields that are always part of this form. These cannot be removed.
          </p>
        </div>
        {baseFields.length === 0 ? (
          <p className="text-xs text-stone-400">No base fields defined for this workflow.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {baseFields.map((f) => (
              <span
                key={f.key}
                className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-label text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
              >
                <span className="font-semibold">{f.label}</span>
                <span className="text-stone-400">· {f.key}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* States */}
      <section className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
        <h2 className="mb-3 text-sm font-bold">States</h2>
        <div className="flex flex-wrap items-center gap-2">
          {def.states.map((s) => (
            <Badge key={s.id} color={s.color || undefined}>
              {s.name}
              {s.isInitial && ' · initial'}
              {s.isTerminal && ' · terminal'}
            </Badge>
          ))}
        </div>
      </section>

      {/* Transitions */}
      <section className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
        <h2 className="mb-3 text-sm font-bold">Transitions</h2>
        <ul className="space-y-1.5 text-sm">
          {def.transitions.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{t.name}:</span>
              <Badge color={stateById.get(t.fromStateId)?.color}>{stateById.get(t.fromStateId)?.name}</Badge>
              <span className="text-stone-400">→</span>
              <Badge color={stateById.get(t.toStateId)?.color}>{stateById.get(t.toStateId)?.name}</Badge>
              {t.guard?.requiredFields && t.guard.requiredFields.length > 0 && (
                <span className="text-label text-amber-600">requires: {t.guard.requiredFields.join(', ')}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Custom fields */}
      <FieldsSection workflowId={id} fields={def.fields} />
    </div>
  );
}

function FieldsSection({ workflowId, fields }: { workflowId: string; fields: FieldDefinition[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['workflow', workflowId] });
  const cap = 15;

  const del = useMutation({
    mutationFn: (fieldId: string) => workflowService.deleteField(workflowId, fieldId),
    onSuccess: refresh,
  });

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">Custom fields</h2>
          <p className="text-xs text-stone-500">{fields.length} / {cap} used</p>
        </div>
        <Button size="sm" onClick={() => setOpen((v) => !v)} className="gap-1" disabled={fields.length >= cap}>
          <Plus className="size-3.5" /> Add field
        </Button>
      </div>

      {open && (
        <AddFieldForm
          workflowId={workflowId}
          disabled={fields.length >= cap}
          onDone={() => { setOpen(false); refresh(); }}
        />
      )}

      <div className="space-y-1.5">
        {fields.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2 text-sm dark:border-stone-800">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{f.label}</span>
              <Badge>{f.dataType}</Badge>
              <span className="text-label text-stone-400">key: {f.key}</span>
              {f.required && <Badge color="#ef4444">required</Badge>}
              {f.options.length > 0 && <span className="text-label text-stone-400">[{f.options.join(', ')}]</span>}
            </div>
            <button
              type="button"
              aria-label={`Delete field ${f.label}`}
              onClick={() => del.mutate(f.id)}
              disabled={del.isPending}
              className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {fields.length === 0 && (
          <p className="text-xs text-stone-400 py-2">No custom fields yet. Add one above.</p>
        )}
      </div>
      {del.error && <div className="mt-2"><ErrorNote>{apiErrorMessage(del.error)}</ErrorNote></div>}
    </section>
  );
}

function AddFieldForm({ workflowId, disabled, onDone }: { workflowId: string; disabled: boolean; onDone: () => void }) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [dataType, setDataType] = useState<FieldType>('string');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState('');

  const create = useMutation({
    mutationFn: () =>
      workflowService.createField(workflowId, {
        key,
        label,
        dataType,
        required,
        options: dataType === 'enum' ? options.split(',').map((s) => s.trim()).filter(Boolean) : [],
      }),
    onSuccess: onDone,
  });

  return (
    <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-950/40">
      {disabled && <div className="mb-3"><ErrorNote>Field cap reached (15). Delete one to add another.</ErrorNote></div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="fkey">Key <span className="text-stone-400 font-normal">(snake_case)</span></Label>
          <Input id="fkey" value={key} onChange={(e) => setKey(e.target.value)} placeholder="referral_source" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="flabel">Label</Label>
          <Input id="flabel" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Referral Source" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ftype">Type</Label>
          <select
            id="ftype"
            value={dataType}
            onChange={(e) => setDataType(e.target.value as FieldType)}
            className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-900"
          >
            {(['string', 'number', 'date', 'bool', 'enum', 'email'] as FieldType[]).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {dataType === 'enum' && (
          <div className="space-y-1.5">
            <Label htmlFor="fopts">Options (comma-separated)</Label>
            <Input id="fopts" value={options} onChange={(e) => setOptions(e.target.value)} placeholder="saas, retail, finance" />
          </div>
        )}
        <div className="flex items-center gap-2 pt-6">
          <input id="freq" type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="size-4 rounded border-stone-300" />
          <Label htmlFor="freq">Required</Label>
        </div>
      </div>
      {create.error && <div className="mt-3"><ErrorNote>{apiErrorMessage(create.error)}</ErrorNote></div>}
      <div className="mt-4">
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending || disabled || !key || !label}>
          {create.isPending ? 'Adding…' : 'Add field'}
        </Button>
      </div>
    </div>
  );
}
