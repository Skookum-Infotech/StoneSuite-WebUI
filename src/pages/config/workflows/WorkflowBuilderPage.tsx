import { useState, useEffect, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Check,
  X,
  Sparkles,
  Users,
  Building2,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AxiosError } from 'axios';
import { workflowService, userService } from '@/services/tenantServices';
import { isCrmWorkflowKey } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Spinner, ErrorNote, EmptyState, Badge } from '@/components/tenant/ui';
import { ApproverPicker, MAX_APPROVERS } from '@/components/tenant/ApproverPicker';
import { StatesReference } from './StatesReference';
import { CrmStatusApprovers } from './CrmStatusApprovers';
import { ApprovalChainSection } from './ApprovalChainSection';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { cn } from '@/lib/utils';
import type { FieldType, FieldDefinition } from '@/types/tenant';

const FIELD_CAP = 15;

// APPROVAL_CHAIN_WORKFLOWS mirrors the workflow keys registered in the
// backend's approvalchain package (approvalchain/registry.go) -- workflows
// with a configurable module approval chain. Keep in sync: adding a module
// there without adding its key here just hides the section; the reverse
// (adding a key here without a backend registry entry) 400s on load.
const APPROVAL_CHAIN_WORKFLOWS = new Set([
  'estimate',
  'quote',
  'sales_order',
  'purchase_order',
  'requisition',
  'vendor_bill',
  'vendor_payment',
  'vendor_credit',
  'expense',
  'installation',
  'invoice',
  'payment',
  'credit_memo',
  'refund',
]);

// Same icon per entity type used on the CRM detail pages, but the badge
// itself is the uniform bg-accent/text-accent-foreground CrmPageHeader now
// renders for every entity (its old per-entity color props are deprecated).
const ENTITY_ICON: Record<string, LucideIcon> = {
  lead: Sparkles,
  prospect: Users,
  customer: Building2,
};

export default function WorkflowBuilderPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [fieldFormOpen, setFieldFormOpen] = useState(false);

  const { data: def, isLoading, error } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => workflowService.get(id),
    staleTime: 10 * 60 * 1000,
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (def?.workflow.name) {
      setLabel(id, def.workflow.name);
      return () => clearLabel(id);
    }
  }, [id, def?.workflow.name, setLabel, clearLabel]);

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => workflowService.setEnabled(id, enabled),
    onSuccess: () => {
      setToggleError(null);
      qc.invalidateQueries({ queryKey: ['workflow', id] });
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['workflows', 'enabled'] });
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

  const enabled = def.workflow.enabled;
  const EntityIcon = ENTITY_ICON[def.workflow.key.toLowerCase()] ?? WorkflowIcon;
  const crmKey = isCrmWorkflowKey(def.workflow.key) ? def.workflow.key : null;
  const hasApprovalChain = APPROVAL_CHAIN_WORKFLOWS.has(def.workflow.key);

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-stone-200 bg-background px-4 py-5 sm:px-8 dark:border-stone-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10">
              <EntityIcon className="h-4 w-4 text-accent-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-stone-900 truncate dark:text-white">
                  {def.workflow.name}
                </h1>
                <span className="rounded-lg bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-400 dark:bg-stone-800">
                  {def.workflow.key}
                </span>
                <label className="flex items-center gap-1.5 select-none">
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) => { setToggleError(null); toggle.mutate(checked); }}
                    disabled={toggle.isPending}
                    aria-label={enabled ? `Disable ${def.workflow.name}` : `Enable ${def.workflow.name}`}
                  />
                  <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                    {toggle.isPending ? 'Saving…' : enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>
              {def.workflow.description && (
                <p className="text-sm text-stone-500 leading-relaxed">{def.workflow.description}</p>
              )}
              {toggleError && (
                <div className="mt-1.5 max-w-xs">
                  <ErrorNote>{toggleError}</ErrorNote>
                </div>
              )}
            </div>
          </div>

          <Link
            to="/config/workflows"
            aria-label="Back to All forms"
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            <ChevronLeft className="size-3.5" />
            Back
          </Link>
        </div>
      </div>

      {/* Content — editable sections lead (approvals, fields); the read-only
          states/transitions summary trails, but gets full width so it doesn't
          feel cramped once a workflow has more than a couple of steps.
          No max-w wrapper — matches WorkflowsPage/RolesPage, which let
          content use the full available width rather than centering in a
          narrow column. */}
      <div className="flex-1 overflow-y-auto modal-scrollbar">
        <div className="space-y-6 px-4 py-8 sm:px-8">
          {crmKey && (
            <Section title="Approval chain" action={<Badge size="sm">Every status</Badge>}>
              <ApproversSection workflowId={id} approverUserIds={def.workflow.approverUserIds} />
            </Section>
          )}

          {hasApprovalChain && <ApprovalChainSection workflowId={id} />}

          {crmKey ? (
            <CrmStatusApprovers workflowKey={crmKey} />
          ) : (
            <StatesReference
              workflowKey={def.workflow.key}
              states={def.states}
              transitions={def.transitions}
            />
          )}

          <Section
            title="Custom fields"
            action={
              <div className="flex items-center gap-3">
                <FieldsCounter count={def.fields.length} />
                {!fieldFormOpen && (
                  <button
                    type="button"
                    onClick={() => setFieldFormOpen(true)}
                    disabled={def.fields.length >= FIELD_CAP}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 transition-colors hover:bg-brand-hover disabled:opacity-50"
                  >
                    <Plus className="size-3.5" /> Add field
                  </button>
                )}
              </div>
            }
          >
            <FieldsSection workflowId={id} fields={def.fields} open={fieldFormOpen} onOpenChange={setFieldFormOpen} />
          </Section>

        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[10px] border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-stone-100 pb-3 dark:border-stone-800">
        <h2 className="text-sm font-semibold text-stone-950 dark:text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function FieldsCounter({ count }: { count: number }) {
  return (
    <span className="text-xs text-stone-400 tabular-nums">
      {count} / {FIELD_CAP}
    </span>
  );
}

function ApproversSection({ workflowId, approverUserIds }: { workflowId: string; approverUserIds: string[] }) {
  const qc = useQueryClient();
  const usersQ = useQuery({ queryKey: ['users'], queryFn: userService.listUsers, staleTime: 5 * 60 * 1000 });
  const [error, setError] = useState<string | null>(null);

  const activeUsers = (usersQ.data ?? []).filter((u) => u.status === 'active');

  const update = useMutation({
    mutationFn: (approverIds: string[]) => workflowService.updateApprovers(workflowId, approverIds),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['workflow', workflowId] });
    },
    onError: (err: unknown) => setError(apiErrorMessage(err, 'Failed to update approvers.')),
  });

  const addApprover = (userId: string) => {
    if (approverUserIds.length >= MAX_APPROVERS || approverUserIds.includes(userId)) return;
    update.mutate([...approverUserIds, userId]);
  };
  const removeApprover = (userId: string) => update.mutate(approverUserIds.filter((id) => id !== userId));

  return (
    <div>
      <p className="mb-3 max-w-xl text-xs text-stone-500">
        Up to {MAX_APPROVERS} active users required to sign off before a record can leave <em>any</em> status in this
        workflow. Leave empty to skip. For approvers scoped to a single status, configure them individually below.
      </p>
      {usersQ.isLoading ? (
        <Spinner label="Loading users…" />
      ) : (
        <ApproverPicker
          users={activeUsers}
          selected={approverUserIds}
          onAdd={addApprover}
          onRemove={removeApprover}
          disabled={update.isPending}
        />
      )}
      {error && (
        <div className="mt-2">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </div>
  );
}

const FIELD_COLS = 'grid-cols-[1.4fr_1fr_0.7fr_0.6fr_1fr_3.25rem]';

function FieldsSection({
  workflowId,
  fields,
  open,
  onOpenChange,
}: {
  workflowId: string;
  fields: FieldDefinition[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['workflow', workflowId] });
  const atCap = fields.length >= FIELD_CAP;

  const del = useMutation({
    mutationFn: (fieldId: string) => workflowService.deleteField(workflowId, fieldId),
    onSuccess: refresh,
  });

  return (
    <div>
      {atCap && !open && (
        <p className="mb-3 text-xs text-stone-400">Field cap reached ({FIELD_CAP}). Delete one to add another.</p>
      )}

      {fields.length === 0 && !open ? (
        <EmptyState>No custom fields yet — add one to extend this form.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <div className={cn('grid min-w-[560px] gap-x-3 border-b border-stone-200 pb-2 text-xs font-semibold text-stone-900 dark:border-stone-800 dark:text-stone-100', FIELD_COLS)}>
            <span>Label</span>
            <span>Key</span>
            <span>Type</span>
            <span>Req.</span>
            <span>Options</span>
            <span />
          </div>
          {open && (
            <NewFieldRow
              workflowId={workflowId}
              onDone={() => { onOpenChange(false); refresh(); }}
              onCancel={() => onOpenChange(false)}
            />
          )}
          {fields.map((f) => (
            <div
              key={f.id}
              className={cn('grid min-w-[560px] items-center gap-x-3 border-b border-stone-100 py-2.5 text-xs dark:border-stone-800/60', FIELD_COLS)}
            >
              <span className="truncate font-semibold text-stone-900 dark:text-stone-100">{f.label}</span>
              <span className="truncate font-mono text-xs text-stone-400">{f.key}</span>
              <span className="text-xs text-stone-400">{f.dataType}</span>
              <span className="text-xs font-semibold">
                {f.required ? <span className="text-amber-600 dark:text-amber-400">Yes</span> : <span className="text-stone-300 dark:text-stone-600">—</span>}
              </span>
              <span className="truncate text-xs text-stone-400">{f.options.length > 0 ? f.options.join(', ') : '—'}</span>
              <button
                type="button"
                aria-label={`Delete field ${f.label}`}
                onClick={() => del.mutate(f.id)}
                disabled={del.isPending}
                className="justify-self-end rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {del.error && <div className="mt-2"><ErrorNote>{apiErrorMessage(del.error)}</ErrorNote></div>}
    </div>
  );
}

// Inline "new row" at the top of the table — mirrors the data rows' column
// widths so creating a field feels like editing a spreadsheet, not filling
// out a separate form.
function NewFieldRow({ workflowId, onDone, onCancel }: { workflowId: string; onDone: () => void; onCancel: () => void }) {
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

  const canSave = Boolean(key) && Boolean(label) && !create.isPending;

  return (
    <>
      <div className={cn('grid min-w-[560px] items-center gap-x-3 border-b border-stone-100 bg-stone-50/70 py-2 dark:border-stone-800/60 dark:bg-stone-950/30', FIELD_COLS)}>
        <Input aria-label="New field label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" className="h-8 text-xs" />
        <Input aria-label="New field key (snake_case)" value={key} onChange={(e) => setKey(e.target.value)} placeholder="key_name" className="h-8 font-mono text-xs" />
        <select
          aria-label="New field type"
          value={dataType}
          onChange={(e) => setDataType(e.target.value as FieldType)}
          className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-xs dark:border-stone-700 dark:bg-stone-900"
        >
          {(['string', 'number', 'date', 'bool', 'enum', 'email'] as FieldType[]).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <div className="flex justify-start">
          <input
            aria-label="Required"
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="size-4 rounded border-stone-300"
          />
        </div>
        {dataType === 'enum' ? (
          <Input aria-label="New field options, comma-separated" value={options} onChange={(e) => setOptions(e.target.value)} placeholder="a, b, c" className="h-8 text-xs" />
        ) : (
          <span className="text-xs text-stone-300 dark:text-stone-600">—</span>
        )}
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            aria-label="Save field"
            onClick={() => create.mutate()}
            disabled={!canSave}
            className="rounded-lg p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-40 dark:hover:bg-green-950/30"
          >
            <Check className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Cancel new field"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      {create.error && <div className="border-b border-stone-100 py-2 dark:border-stone-800/60"><ErrorNote>{apiErrorMessage(create.error)}</ErrorNote></div>}
    </>
  );
}
