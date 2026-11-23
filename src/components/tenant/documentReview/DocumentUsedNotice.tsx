import * as React from 'react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FileCheck2 } from 'lucide-react';
import { documentRoutes } from '@/lib/documentExtractionRoutes';
import type { DocumentExtractionDocType } from '@/types/documentExtraction';

interface DocumentUsedNoticeProps {
  fileName: string;
  /** The record created from the document, when the server reported it. */
  usedRecordUuid: string | undefined;
  /** Decides the copy and where "Back" (the list) goes. */
  docType: DocumentExtractionDocType;
}

/** Replaces the whole review screen for a document that already created a
 *  record: there is nothing left to review, so no empty form, no Discard and no
 *  "Confirm all" — just the way to the order. Takes focus so it is announced. */
export function DocumentUsedNotice({ fileName, usedRecordUuid, docType }: DocumentUsedNoticeProps): React.JSX.Element {
  const routes = documentRoutes(docType);
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="flex flex-1 items-start justify-center p-6">
      <section className="w-full max-w-md rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 text-center shadow-sm">
        <FileCheck2 className="mx-auto size-8 text-accent-foreground" aria-hidden="true" />
        <h2 ref={ref} tabIndex={-1} className="mt-3 text-base font-bold text-stone-900 dark:text-stone-100 outline-none">
          This document was already used
        </h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          {fileName} has already been turned into a {routes.noun}, so it can't be used again.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {usedRecordUuid && (
            <Link
              to={routes.recordPath(usedRecordUuid)}
              className="inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-stone-950 shadow-sm transition hover:bg-brand-hover"
            >
              Open the {routes.noun}
            </Link>
          )}
          <Link
            to={routes.listPath}
            className="inline-flex items-center rounded-lg border border-stone-200 dark:border-stone-700 px-4 py-2 text-sm font-medium text-stone-700 dark:text-stone-300 transition-colors hover:bg-stone-50 dark:hover:bg-white/10"
          >
            Back to {routes.label}s
          </Link>
        </div>
      </section>
    </div>
  );
}
