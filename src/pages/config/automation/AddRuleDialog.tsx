import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { Plus, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/api/tenantClient';
import { Input } from '@/components/ui/input';
import { AUTOMATION_RULES_QUERY_KEY } from '@/hooks/useAutomationKillSwitch';
import { audienceLabel } from '@/lib/automationCopy';
import {
  buildRuleInput,
  DEFAULT_STAGE,
  kindOption,
  MAX_STAGES,
  RULE_KIND_OPTIONS,
  validateRuleDraft,
  type StageDirection,
  type StageDraft,
} from '@/lib/automationRuleForm';
import { automationRuleService } from '@/services/automationRuleService';

interface Props {
  onClose: () => void;
}

const FIELD =
  'h-8 rounded-lg border border-stone-200 bg-white px-2 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200';
const LABEL = 'flex flex-col gap-1 text-xs font-medium text-stone-600 dark:text-stone-300';

/** Form to add a new automation rule. New rules start switched off. */
export function AddRuleDialog({ onClose }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [kind, setKind] = useState(RULE_KIND_OPTIONS[0].kind);
  const [stages, setStages] = useState<StageDraft[]>([DEFAULT_STAGE]);
  const [submitted, setSubmitted] = useState(false);

  const option = kindOption(kind);
  const problem = validateRuleDraft(name, kind, stages);

  const create = useMutation({
    mutationFn: () => automationRuleService.create(buildRuleInput(name, kind, stages)),
    onSuccess: (rule) => {
      toast.success(`${rule.name} added. It is off until you turn it on.`);
      queryClient.invalidateQueries({ queryKey: [AUTOMATION_RULES_QUERY_KEY] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not add the rule.')),
  });

  function updateStage(index: number, patch: Partial<StageDraft>) {
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!problem) create.mutate();
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !create.isPending && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[10000] max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-stone-900">
          <Dialog.Title className="text-sm font-bold text-stone-900 dark:text-white">Add automation rule</Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-stone-500">
            New rules start switched off, so nothing is sent until you turn them on.
          </Dialog.Description>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-4" noValidate>
            <label className={LABEL}>
              Name
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Early invoice nudge"
                aria-label="Rule name"
              />
            </label>
            <label className={LABEL}>
              Reminds about
              <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Rule type" className={FIELD}>
                {RULE_KIND_OPTIONS.map((o) => (
                  <option key={o.kind} value={o.kind}>
                    {o.label}
                  </option>
                ))}
              </select>
              {option && <span className="font-normal text-stone-500">{audienceLabel(option.audience)}</span>}
            </label>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-medium text-stone-600 dark:text-stone-300">Reminders</legend>
              {stages.map((stage, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={stage.days}
                    inputMode="numeric"
                    onChange={(e) => updateStage(i, { days: e.target.value })}
                    aria-label={`Reminder ${i + 1} days`}
                    className="w-16"
                  />
                  <span className="text-xs text-stone-500">days</span>
                  <select
                    value={stage.direction}
                    onChange={(e) => updateStage(i, { direction: e.target.value as StageDirection })}
                    aria-label={`Reminder ${i + 1} before or after`}
                    className={FIELD}
                  >
                    <option value="before">before</option>
                    <option value="after">after</option>
                  </select>
                  <span className="min-w-0 truncate text-xs text-stone-500">{option?.anchor}</span>
                  {stages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setStages((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={`Remove reminder ${i + 1}`}
                      className="ml-auto rounded p-1 text-stone-400 hover:text-stone-700"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
              {stages.length < MAX_STAGES && (
                <button
                  type="button"
                  onClick={() => setStages((prev) => [...prev, DEFAULT_STAGE])}
                  aria-label="Add another reminder"
                  className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-brand-dark hover:underline"
                >
                  <Plus className="size-3.5" aria-hidden="true" /> Add another reminder
                </button>
              )}
            </fieldset>
            {submitted && problem && (
              <p role="alert" className="text-xs text-red-500">
                {problem}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={create.isPending}
                aria-label="Cancel"
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={create.isPending}
                aria-label="Add rule"
                className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
              >
                {create.isPending ? 'Adding…' : 'Add rule'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
