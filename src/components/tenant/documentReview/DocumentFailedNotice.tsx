import * as React from 'react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FileX2 } from 'lucide-react';
import { SALES_ORDER_NEW_PATH } from '@/lib/documentExtractionRoutes';

interface DocumentFailedNoticeProps {
  fileName: string;
  /** Why the document couldn't be read (the server's message, or the
   *  client-side text for its failure code). */
  reason: string;
  /** Where "Back" goes (the Sales Orders list, which also has the upload). */
  listPath: string;
}

/** Replaces the whole review screen for a document that couldn't be read
 *  (opened from a link after the upload dialog closed): there is nothing to
 *  review or discard, so it states the real reason and offers the two ways on.
 *  Takes focus so it is announced. */
export function DocumentFailedNotice({ fileName, reason, listPath }: DocumentFailedNoticeProps): React.JSX.Element {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="flex flex-1 items-start justify-center p-6">
      <section className="w-full max-w-md rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 text-center shadow-sm">
        <FileX2 className="mx-auto size-8 text-destructive" aria-hidden="true" />
        <h2 ref={ref} tabIndex={-1} className="mt-3 text-base font-bold text-stone-900 dark:text-stone-100 outline-none">
          We couldn&apos;t read this document
        </h2>
        <p className="mt-1 break-words text-xs font-medium text-stone-500 dark:text-stone-400">{fileName}</p>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{reason}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            to={SALES_ORDER_NEW_PATH}
            className="inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-stone-950 shadow-sm transition hover:bg-brand-hover"
          >
            Enter the order manually
          </Link>
          <Link
            to={listPath}
            className="inline-flex items-center rounded-lg border border-stone-200 dark:border-stone-700 px-4 py-2 text-sm font-medium text-stone-700 dark:text-stone-300 transition-colors hover:bg-stone-50 dark:hover:bg-white/10"
          >
            Back to Sales Orders
          </Link>
        </div>
      </section>
    </div>
  );
}
