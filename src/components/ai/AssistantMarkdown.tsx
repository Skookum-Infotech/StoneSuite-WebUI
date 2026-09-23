import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
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
 *  record text anyone with write access controls. */
export const AssistantMarkdown = memo(function AssistantMarkdown({ text, canOpenCitation, onOpenCitation }: AssistantMarkdownProps) {
  const navigate = useNavigate();

  const components: Components = {
    a: ({ href, children }) => {
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
  };

  return (
    <div className="space-y-1.5 break-words [&_a]:underline [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-1 dark:[&_code]:bg-white/10 [&_ol]:list-decimal [&_ol]:space-y-0.5 [&_ol]:pl-4 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:space-y-0.5 [&_ul]:pl-4">
      <ReactMarkdown components={components}>{linkCitationMarkers(text)}</ReactMarkdown>
    </div>
  );
});
