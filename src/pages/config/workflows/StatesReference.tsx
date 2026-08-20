import { Lock } from 'lucide-react';
import type { WorkflowState, WorkflowTransition } from '@/types/tenant';

function stripWorkflowPrefix(name: string, workflowKey: string): string {
  const prefix = `${workflowKey}-`;
  return name.toLowerCase().startsWith(prefix.toLowerCase()) ? name.slice(prefix.length) : name;
}

// States & transitions are fixed configuration for the workflow type -- a
// pure read-only reference. Approval configuration for these workflows lives
// in ApprovalChainSection (relational document modules) or the CRM status
// grid (lead/prospect/customer) -- neither is per-generic-state, so this
// component doesn't edit anything.
export function StatesReference({
  workflowKey,
  states,
  transitions,
}: {
  workflowKey: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
}) {
  const ordered = [...states].sort((a, b) => a.sortOrder - b.sortOrder);
  const stateById = new Map(states.map((s) => [s.id, s]));
  const nameFor = (s?: WorkflowState) => (s ? stripWorkflowPrefix(s.name, workflowKey) : '—');

  return (
    <section className="rounded-[10px] border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-stone-100 pb-3 dark:border-stone-800">
        <h2 className="text-sm font-semibold text-stone-950 dark:text-white">States &amp; transitions</h2>
        <span className="flex items-center gap-1 text-xs text-stone-400">
          <Lock className="size-3" /> Structure read only
        </span>
      </div>

      {ordered.length === 0 ? (
        <p className="text-xs text-stone-400">No states configured.</p>
      ) : (
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((s) => {
            const outgoing = transitions.filter((t) => t.fromStateId === s.id);
            return (
              <div key={s.id}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-block size-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
                  <span className="truncate text-xs font-semibold text-stone-900 dark:text-stone-100">{nameFor(s)}</span>
                  {s.isInitial && <span className="shrink-0 text-2xs text-stone-400">start</span>}
                  {s.isTerminal && <span className="shrink-0 text-2xs text-stone-400">end</span>}
                </div>
                {outgoing.length > 0 && (
                  <ul className="mt-1.5 space-y-1 border-l border-stone-100 pl-3 dark:border-stone-800">
                    {outgoing.map((t) => (
                      <li key={t.id} className="truncate text-xs text-stone-400">
                        <span className="text-stone-500 dark:text-stone-400">{t.name}</span> → {nameFor(stateById.get(t.toStateId))}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
