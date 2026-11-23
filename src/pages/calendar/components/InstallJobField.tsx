import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fieldCls } from '@/components/crm/formUtils';
import { fabricationService } from '@/services/fabricationService';
import type { FabricationJob } from '@/types/fabrication';

interface Props {
  /** Label of the chosen job ("FJ-1042 · Acme"), or '' when none is chosen. */
  chosen: string;
  onPick: (job: FabricationJob) => void;
  onClear: () => void;
}

const DEBOUNCE_MS = 250;
const RESULT_LIMIT = 8;
const MIN_TERM = 2;

/** Searches fabrication jobs by number or customer and picks one. */
export function InstallJobField({ chosen, onPick, onClear }: Props) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const inputId = useId();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term]);

  const { data, isFetching } = useQuery({
    queryKey: ['install-appointments', 'job-search', debounced],
    queryFn: () => fabricationService.searchJobs({ search: debounced, limit: RESULT_LIMIT }),
    enabled: !chosen && debounced.length >= MIN_TERM,
  });

  if (chosen) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-[10px] border border-stone-300 bg-stone-50 px-3 py-2 text-xs">
        <span className="min-w-0 truncate font-medium text-stone-800">{chosen}</span>
        <button type="button" onClick={onClear} className="shrink-0 font-medium text-stone-600 hover:underline">
          Change job
        </button>
      </div>
    );
  }

  const records = data?.records ?? [];
  return (
    <div>
      <input
        id={inputId}
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search by job number or customer"
        aria-label="Fabrication job"
        className={fieldCls}
      />
      {isFetching && <p className="mt-1 text-xs text-stone-500">Searching…</p>}
      {records.length > 0 && (
        <ul className="mt-1 max-h-40 divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-200">
          {records.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                onClick={() => onPick(job)}
                className="w-full px-3 py-1.5 text-left text-xs text-stone-800 hover:bg-stone-50"
              >
                <span className="font-semibold">{job.jobNumber}</span> · {job.customer.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!isFetching && debounced.length >= MIN_TERM && records.length === 0 && (
        <p className="mt-1 text-xs text-stone-500">No jobs match.</p>
      )}
    </div>
  );
}
