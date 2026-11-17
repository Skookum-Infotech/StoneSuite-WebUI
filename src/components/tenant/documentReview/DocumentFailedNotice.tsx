import * as React from 'react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FileX2 } from 'lucide-react';
import { documentRoutes } from '@/lib/documentExtractionRoutes';
import type { DocumentExtractionDocType } from '@/types/documentExtraction';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
interface DocumentFailedNoticeProps {
  fileName: string;
  /** Why the document couldn't be read (the server's message, or the
   *  client-side text for its failure code). */
  reason: string;
  /** Decides the copy and where "Back" (the list, which also has the upload) goes. */
  docType: DocumentExtractionDocType;
}

/** Replaces the whole review screen for a document that couldn't be read
 *  (opened from a link after the upload dialog closed): there is nothing to
 *  review or discard, so it states the real reason and offers the two ways on.
 *  Takes focus so it is announced. */
export function DocumentFailedNotice({ fileName, reason, docType }: DocumentFailedNoticeProps): React.JSX.Element {
  const routes = documentRoutes(docType);
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="flex flex-1 items-start justify-center p-6">
      <section className="w-full max-w-md rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 text-center shadow-sm">
        <FileX2 className="mx-auto size-8 text-destructive" aria-hidden="true" />
        <h2 ref={ref} tabIndex={-1} className="mt-3 dark:text-stone-100 outline-none type-dialog-title">
          We Couldn&apos;t Read This Document
        </h2>
        <p className="mt-1 break-words text-xs font-medium text-stone-500 dark:text-stone-400">{fileName}</p>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{reason}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            to={routes.newPath}
            className={buttonVariants()}
          >
            Enter the {routes.manualNoun} manually
          </Link>
          <Link
            to={routes.listPath}
            className={cn(buttonVariants({ variant: 'outline' }), 'dark:border-stone-700 dark:text-stone-300 dark:hover:bg-white/10')}
          >
            Back to {routes.label}s
          </Link>
        </div>
      </section>
    </div>
  );
}
