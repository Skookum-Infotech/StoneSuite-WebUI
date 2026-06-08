import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowRight, Pencil, X } from 'lucide-react';
import { workflowService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge, ErrorNote, Spinner, EmptyState } from '@/components/tenant/ui';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { coerceCustomFields } from '@/lib/customFields';
import type { WorkflowDefinition, WorkflowRecord, WorkflowState } from '@/types/tenant';

export function RecordsPanel({ def }: { def: WorkflowDefinition }) {
  const qc = useQueryClient();
  const wfId = def.workflow.id;
  const stateById = new Map<string, WorkflowState>(def.states.map((s) => [s.id, s]));

  const recordsQ = useQuery({
    queryKey: ['records', wfId],
    queryFn: () => workflowService.listRecords(wfId),
  });

  const [showCreate, setShowCreate] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['records', wfId] });

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">Records</h2>
          <p className="text-xs text-stone-500">
            Scope: <Badge>{recordsQ.data?.scope ?? '—'}</Badge>
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)} className="gap-1">
          {showCreate ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          {showCreate ? 'Cancel' : 'New record'}
        </Button>
      </div>

      {showCreate && (
        <CreateRecordForm
          def={def}
          onDone={() => {
            setShowCreate(false);
            invalidate();
          }}
        />
      )}

      {recordsQ.isLoading && <Spinner />}
      {recordsQ.error && <ErrorNote>{apiErrorMessage(recordsQ.error)}</ErrorNote>}
      {recordsQ.data && recordsQ.data.records.length === 0 && (
        <EmptyState>No records yet — create one above.</EmptyState>
      )}

      <div className="space-y-2">
        {recordsQ.data?.records.map((rec) => (
          <RecordRow key={rec.id} def={def} rec={rec} stateById={stateById} onChanged={invalidate} />
        ))}
      </div>
    </section>
  );
}

function CreateRecordForm({ def, onDone }: { def: WorkflowDefinition; onDone: () => void }) {
  const [name, setName] = useState('');
  const [custom, setCustom] = useState<Record<string, unknown>>({});
  const setField = (key: string, value: unknown) => setCustom((c) => ({ ...c, [key]: value }));

  const create = useMutation({
    mutationFn: () =>
      workflowService.createRecord(def.workflow.id, {
        coreFields: name ? { name } : {},
        customFields: coerceCustomFields(def.fields, custom),
      }),
    onSuccess: onDone,
  });

  return (
    <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-950/40">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rec-name">Name</Label>
          <Input id="rec-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Globex Corp" />
        </div>
        {def.fields.map((f) => (
          <DynamicFieldInput key={f.id} field={f} value={custom[f.key]} onChange={setField} />
        ))}
      </div>
      {create.error && <div className="mt-3"><ErrorNote>{apiErrorMessage(create.error)}</ErrorNote></div>}
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create record'}
        </Button>
      </div>
    </div>
  );
}

function RecordRow({
  def,
  rec,
  stateById,
  onChanged,
}: {
  def: WorkflowDefinition;
  rec: WorkflowRecord;
  stateById: Map<string, WorkflowState>;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const current = stateById.get(rec.currentStateId);
  const targets = def.transitions.filter((t) => t.fromStateId === rec.currentStateId);
  const name = (rec.coreFields?.name as string) || '(unnamed)';

  const transition = useMutation({
    mutationFn: (toStateId: string) => workflowService.transition(rec.id, toStateId),
    onSuccess: onChanged,
  });

  return (
    <div className="rounded-xl border border-stone-200 p-4 dark:border-stone-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{name}</span>
          {current && <Badge color={current.color || undefined}>{current.name}</Badge>}
        </div>
        <button
          type="button"
          aria-label="Edit fields"
          onClick={() => setEditing((v) => !v)}
          className="flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-label font-semibold text-stone-500 hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          <Pencil className="size-3" /> {editing ? 'Close' : 'Edit fields'}
        </button>
      </div>

      {/* Custom field summary */}
      {Object.keys(rec.customFields ?? {}).length > 0 && !editing && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(rec.customFields).map(([k, v]) => (
            <Badge key={k}>
              {k}: {String(v)}
            </Badge>
          ))}
        </div>
      )}

      {editing && <EditFieldsForm def={def} rec={rec} onDone={() => { setEditing(false); onChanged(); }} />}

      {/* Transition controls */}
      {targets.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-label font-semibold text-stone-400">Move to:</span>
          {targets.map((t) => {
            const to = stateById.get(t.toStateId);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => transition.mutate(t.toStateId)}
                disabled={transition.isPending}
                className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-label font-semibold text-stone-700 transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-50 dark:border-stone-700 dark:text-stone-200"
              >
                {t.name} <ArrowRight className="size-3" /> {to?.name}
              </button>
            );
          })}
        </div>
      )}

      {transition.error && <div className="mt-2"><ErrorNote>{apiErrorMessage(transition.error)}</ErrorNote></div>}
    </div>
  );
}

function EditFieldsForm({
  def,
  rec,
  onDone,
}: {
  def: WorkflowDefinition;
  rec: WorkflowRecord;
  onDone: () => void;
}) {
  const [custom, setCustom] = useState<Record<string, unknown>>({ ...rec.customFields });
  const setField = (key: string, value: unknown) => setCustom((c) => ({ ...c, [key]: value }));

  const save = useMutation({
    mutationFn: () => workflowService.updateRecord(rec.id, coerceCustomFields(def.fields, custom)),
    onSuccess: onDone,
  });

  return (
    <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3 dark:border-stone-700 dark:bg-stone-950/40">
      <div className="grid gap-3 sm:grid-cols-2">
        {def.fields.map((f) => (
          <DynamicFieldInput key={f.id} field={f} value={custom[f.key]} onChange={setField} />
        ))}
      </div>
      {save.error && <div className="mt-3"><ErrorNote>{apiErrorMessage(save.error)}</ErrorNote></div>}
      <div className="mt-3">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save fields'}
        </Button>
      </div>
    </div>
  );
}
