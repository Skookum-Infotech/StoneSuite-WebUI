import { useId, useState, type FormEvent } from 'react';
import { Bookmark, Trash2 } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { useSavedViews } from '@/hooks/useSavedViews';
import {
  INVOICE_VIEWS_PAGE, isInvoiceViewState, sameInvoiceView, type InvoiceViewState,
} from '@/lib/invoiceSavedViews';
import { ADD_VIEW_MESSAGES, MAX_VIEW_NAME_LENGTH } from '@/lib/savedViews';

const BTN =
  'flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 h-8 text-xs font-medium text-ink hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

/**
 * Save the current search and sort as a named view, and apply or delete the
 * ones already saved. Views live in this browser for the signed-in user, so
 * they are not shared and do not follow to another device. The dropdown shows
 * the saved view the screen currently matches, if any.
 */
export function InvoiceSavedViews({
  current, onApply,
}: {
  current: InvoiceViewState;
  onApply: (state: InvoiceViewState) => void;
}) {
  const { views, add, remove, persisted } = useSavedViews(INVOICE_VIEWS_PAGE, isInvoiceViewState);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const matching = views.find((v) => sameInvoiceView(v.state, current));

  function save(e: FormEvent) {
    e.preventDefault();
    const result = add(name, current);
    if (!result.ok) {
      setError(ADD_VIEW_MESSAGES[result.error]);
      return;
    }
    setNaming(false);
    setName('');
    setError(null);
  }

  function cancel() {
    setNaming(false);
    setName('');
    setError(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Saved views">
      {views.length > 0 && (
        <>
          <Select
            aria-label="Apply a saved view"
            value={matching?.id ?? ''}
            onChange={(e) => {
              const picked = views.find((v) => v.id === e.target.value);
              if (picked) onApply(picked.state);
            }}
            className="h-8 w-44 text-xs"
          >
            <option value="" disabled>Saved views</option>
            {views.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </Select>
          {matching && (
            <button
              type="button"
              onClick={() => remove(matching.id)}
              aria-label={`Delete saved view ${matching.name}`}
              className={BTN}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </>
      )}

      {naming ? (
        <form onSubmit={save} className="flex flex-wrap items-center gap-1.5" noValidate>
          <input
            type="text"
            autoFocus
            value={name}
            maxLength={MAX_VIEW_NAME_LENGTH + 1}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            placeholder="Name this view"
            aria-label="View name"
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            className="h-8 w-44 rounded-lg border border-stone-200 bg-white px-3 placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ring/40 type-input"
          />
          <button type="submit" className={BTN}>Save</button>
          <button type="button" onClick={cancel} className={BTN}>Cancel</button>
          {error && <p id={errorId} role="alert" className="w-full type-error">{error}</p>}
        </form>
      ) : (
        <button type="button" onClick={() => setNaming(true)} className={BTN}>
          <Bookmark className="size-3.5" aria-hidden="true" />
          Save view
        </button>
      )}

      {!persisted && (
        <p role="status" className="w-full type-helper">
          This browser is not keeping saved views, so they will be gone when you close the page.
        </p>
      )}
    </div>
  );
}
