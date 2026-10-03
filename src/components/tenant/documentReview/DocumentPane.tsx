import * as React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { DocFocus } from '@/hooks/useSalesOrderReviewMode';
import type { ExtractedPageRows } from '@/types/documentExtraction';

interface DocumentPaneProps {
  /** The picked file, if this tab still has it (lost on reload). */
  file: File | undefined;
  fileName: string;
  pages: ExtractedPageRows[];
  focus: DocFocus | null;
}

type Tab = 'original' | 'text';

function isPdf(file: File | undefined): file is File {
  return file !== undefined && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
}

/** Blob URL for a PDF file; revoked on unmount / file change. */
function useBlobUrl(file: File | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!isPdf(file) || typeof URL.createObjectURL !== 'function') return undefined;
    const u = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
      setUrl(null);
    };
  }, [file]);
  return url;
}

/** The source document next to the form: the original PDF (native viewer, opened
 *  at the referenced page) and a Text view of the extracted rows in which the
 *  row behind the focused field is highlighted and scrolled into view. A DOCX,
 *  or a file this tab no longer has, shows the Text view only. */
export function DocumentPane({ file, fileName, pages, focus }: DocumentPaneProps): React.JSX.Element {
  const blobUrl = useBlobUrl(file);
  const hasOriginal = blobUrl !== null;
  const [tab, setTab] = useState<Tab>('original');
  const active: Tab = hasOriginal ? tab : 'text';
  const page = focus?.page ?? 1;
  const reduceMotion = useReducedMotion();
  const highlightRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    highlightRef.current?.scrollIntoView?.({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [focus, reduceMotion]);

  const uid = useId();
  const tabs: { key: Tab; label: string }[] = hasOriginal
    ? [{ key: 'original', label: 'Original' }, { key: 'text', label: 'Text view' }]
    : [{ key: 'text', label: 'Text view' }];
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  // Roving tabindex: arrows / Home / End move focus and selection together.
  const onTabKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const i = tabs.findIndex((t) => t.key === active);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setTab(tabs[next].key);
    tabRefs.current[tabs[next].key]?.focus();
  };

  const tabCls = (t: Tab): string => cn(
    'rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors',
    active === t ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200',
  );

  return (
    <section aria-label={`Document: ${fileName}`} className="flex h-full min-h-0 flex-col bg-stone-100 dark:bg-stone-950">
      <div role="tablist" aria-label="Document view" onKeyDown={onTabKey} className="flex shrink-0 gap-1 border-b border-stone-200 dark:border-stone-800 px-2 pt-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            ref={(el) => { tabRefs.current[t.key] = el; }}
            id={`${uid}-tab-${t.key}`}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            aria-controls={`${uid}-panel`}
            tabIndex={active === t.key ? 0 : -1}
            onClick={() => setTab(t.key)}
            className={tabCls(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${active}`} className="min-h-0 flex-1 overflow-auto bg-white dark:bg-stone-900">
        {active === 'original' && blobUrl && (
          <object
            key={page}
            type="application/pdf"
            data={`${blobUrl}#page=${page}`}
            aria-label={`${fileName}, page ${page}`}
            className="h-full w-full"
          >
            <p className="p-4 text-xs text-stone-600 dark:text-stone-300">This browser can't show the PDF here. Use the Text view instead.</p>
          </object>
        )}
        {active === 'text' && (
          <div className="space-y-4 p-3 font-mono text-xs text-stone-800 dark:text-stone-200">
            {!hasOriginal && (
              <p className="font-sans text-stone-500 dark:text-stone-400">The original file isn't available in this tab, so only the extracted text is shown.</p>
            )}
            {pages.map((p) => (
              <section key={p.page} aria-label={`Page ${p.page}`}>
                <h3 className="mb-1 font-sans text-2xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">Page {p.page}</h3>
                {p.rows.map((row, i) => {
                  const isFocus = focus?.page === p.page && focus.row === i + 1;
                  return (
                    <p
                      key={i}
                      ref={isFocus ? highlightRef : undefined}
                      aria-current={isFocus ? 'true' : undefined}
                      className={cn('whitespace-pre-wrap rounded px-1', isFocus && 'bg-warning/20 dark:bg-amber-500/20 ring-1 ring-warning dark:ring-amber-400')}
                    >
                      {row.words.map((w) => w.text).join(' ')}
                    </p>
                  );
                })}
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
