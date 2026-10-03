import * as React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileClock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PENDING_DOCUMENTS_KEY } from '@/hooks/useDocumentExtraction';
import { fromDocumentPath } from '@/lib/documentExtractionRoutes';
import { relativeTime } from '@/lib/recentRecordRoute';
import { documentExtractionService } from '@/services/documentExtractionService';
import type { DocumentExtraction, DocumentExtractionDocType } from '@/types/documentExtraction';

const PENDING_STALE_MS = 30_000;

interface PendingDocumentsChipProps {
  docType: DocumentExtractionDocType;
  enabled?: boolean;
}

/** "Pending documents (n)" — the caller's own extractions that finished reading
 *  but haven't been turned into a record yet, each a link back to its review
 *  form plus a discard action. Renders nothing at zero. The list scrolls so a
 *  long backlog never runs off the screen. */
export function PendingDocumentsChip({ docType, enabled = true }: PendingDocumentsChipProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: PENDING_DOCUMENTS_KEY,
    queryFn: () => documentExtractionService.list('ready'),
    enabled,
    staleTime: PENDING_STALE_MS,
  });
  const items = (data ?? []).filter((e) => e.docType === docType);
  if (items.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Pending documents, ${items.length}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-accent-foreground/20 bg-accent px-2.5 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/70"
        >
          <FileClock className="size-3.5" aria-hidden="true" />
          Pending documents ({items.length})
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          Ready to review
        </p>
        <ul className="max-h-[60vh] overflow-y-auto modal-scrollbar">
          {items.map((e) => <PendingRow key={e.id} extraction={e} onOpen={() => setOpen(false)} />)}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** One pending document: resume link, when it was uploaded, and a two-step
 *  discard (the staged file is deleted, so the first click only arms it). */
function PendingRow({ extraction: e, onOpen }: { extraction: DocumentExtraction; onOpen: () => void }): React.JSX.Element {
  const queryClient = useQueryClient();
  const [armed, setArmed] = useState(false);
  const discard = useMutation({
    mutationFn: () => documentExtractionService.discard(e.id),
    onSuccess: () => {
      queryClient.setQueryData<DocumentExtraction[]>(PENDING_DOCUMENTS_KEY, (prev) => prev?.filter((x) => x.id !== e.id));
      toast.success(`Discarded ${e.fileName}`);
    },
    onError: () => {
      setArmed(false);
      toast.error(`Couldn't discard ${e.fileName}. Try again.`);
    },
  });

  return (
    <li className="flex items-center gap-1">
      <Link
        to={fromDocumentPath(e.id)}
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-stone-50 dark:hover:bg-white/10 focus-visible:bg-stone-50 dark:focus-visible:bg-white/10 focus-visible:outline-none"
      >
        <span className="truncate font-medium text-stone-900 dark:text-stone-100">{e.fileName}</span>
        <span className="text-stone-500 dark:text-stone-400">Uploaded {relativeTime(e.createdAt)} · Resume review</span>
      </Link>
      <button
        type="button"
        disabled={discard.isPending}
        onClick={() => (armed ? discard.mutate() : setArmed(true))}
        onBlur={() => { if (!discard.isPending) setArmed(false); }}
        aria-label={armed ? `Confirm discard ${e.fileName}` : `Discard ${e.fileName}`}
        className={armed
          ? 'shrink-0 rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60'
          : 'shrink-0 rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-red-600 dark:hover:bg-white/10'}
      >
        {armed ? 'Discard' : <Trash2 className="size-3.5" aria-hidden="true" />}
      </button>
    </li>
  );
}
