import * as React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileClock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PENDING_DOCUMENTS_KEY } from '@/hooks/useDocumentExtraction';
import { fromDocumentPath } from '@/lib/documentExtractionRoutes';
import { documentExtractionService } from '@/services/documentExtractionService';
import type { DocumentExtractionDocType } from '@/types/documentExtraction';

const PENDING_STALE_MS = 30_000;

interface PendingDocumentsChipProps {
  docType: DocumentExtractionDocType;
  enabled?: boolean;
}

/** "Pending documents (n)" — the caller's own extractions that finished reading
 *  but haven't been turned into a record yet, each a link back to its review
 *  form. Renders nothing at zero. */
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
      <PopoverContent align="end" className="w-72 p-2">
        <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          Ready to review
        </p>
        <ul>
          {items.map((e) => (
            <li key={e.id}>
              <Link
                to={fromDocumentPath(e.id)}
                onClick={() => setOpen(false)}
                className="flex flex-col rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-stone-50 dark:hover:bg-white/10 focus-visible:bg-stone-50 dark:focus-visible:bg-white/10 focus-visible:outline-none"
              >
                <span className="truncate font-medium text-stone-900 dark:text-stone-100">{e.fileName}</span>
                <span className="text-stone-500 dark:text-stone-400">Resume review</span>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
