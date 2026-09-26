import { memo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { CITE_PREFIX, linkCitationMarkers } from './assistantText';

interface AssistantMarkdownProps {
  text: string;
  /** Called when marker n is activated; return false when n can't be opened
   *  (then it renders as plain text). */
  canOpenCitation?: (n: number) => boolean;
  onOpenCitation?: (n: number) => void;
}

/** Renders an answer as Markdown. Raw HTML in the model's output is never
 *  rendered (react-markdown escapes it without rehype-raw), and unsafe URL
 *  schemes are stripped by its default urlTransform — the answer can quote
 *  record text anyone with write access controls. GFM (remark-gfm) adds
 *  tables, strikethrough, and autolinks on top of the CommonMark base. */
export const AssistantMarkdown = memo(function AssistantMarkdown({ text, canOpenCitation, onOpenCitation }: AssistantMarkdownProps) {
  const navigate = useNavigate();

  // Stable across renders (see AssistantTurn's memo comment) so a streaming
  // token doesn't force react-markdown to rebuild its whole components map.
  const renderCitationLink = useCallback(
    ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      if (href?.startsWith(CITE_PREFIX)) {
        const n = Number.parseInt(href.slice(CITE_PREFIX.length), 10);
        if (onOpenCitation && canOpenCitation?.(n)) {
          return (
            <button
              type="button"
              onClick={() => onOpenCitation(n)}
              aria-label={`Open source ${n}`}
              className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-brand/15 px-1 align-super text-[10px] font-bold text-brand-dark hover:bg-brand/25 cursor-pointer"
            >
              {n}
            </button>
          );
        }
        return <sup className="mx-0.5 text-[10px] font-semibold text-stone-400">[{n}]</sup>;
      }
      if (href?.startsWith('/')) {
        return (
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              navigate(href);
            }}
          >
            {children}
          </a>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },
    [canOpenCitation, onOpenCitation, navigate],
  );

  const components: Components = { a: renderCitationLink };

  return (
    <div
      className="space-y-1.5 break-words [&_a]:underline
        [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-1 dark:[&_code]:bg-white/10
        [&_pre]:my-1 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/5 [&_pre]:p-2 dark:[&_pre]:bg-white/10
        [&_pre_code]:bg-transparent [&_pre_code]:p-0
        [&_ol]:list-decimal [&_ol]:space-y-0.5 [&_ol]:pl-4 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:space-y-0.5 [&_ul]:pl-4
        [&_del]:opacity-70
        [&_table]:my-1 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse
        [&_th]:border [&_th]:border-stone-200 [&_th]:bg-stone-50 [&_th]:px-1.5 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold dark:[&_th]:border-white/10 dark:[&_th]:bg-white/[0.06]
        [&_td]:border [&_td]:border-stone-200 [&_td]:px-1.5 [&_td]:py-1 dark:[&_td]:border-white/10"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {linkCitationMarkers(text)}
      </ReactMarkdown>
    </div>
  );
});
