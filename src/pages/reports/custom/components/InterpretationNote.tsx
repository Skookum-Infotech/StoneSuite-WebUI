import { Sparkles } from "lucide-react";
import { SMALL_BUTTON } from "./builderStyles";

interface InterpretationNoteProps {
  /** The assistant's one-line reading of the request. */
  summary: string;
  /** Parts of its answer that were unusable and left out. */
  dropped: string[];
  /** Puts the report back as it was before this change; omit when there is nothing to go back to. */
  onUndo?: () => void;
}

/** "Here's what I understood" — shown after the assistant builds or changes a
 *  report, so the user can check it before relying on it. */
export function InterpretationNote({ summary, dropped, onUndo }: InterpretationNoteProps) {
  return (
    <div role="status" className="flex flex-wrap items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
      <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p>
          Here&apos;s what I understood: <span className="font-medium">{summary}</span>
        </p>
        {dropped.length > 0 && <p className="text-xs text-violet-800">I left out: {dropped.join(", ")}</p>}
        <p className="text-xs text-violet-800">Check the settings below before you rely on this report.</p>
      </div>
      {onUndo && (
        <button type="button" aria-label="Undo this change" onClick={onUndo} className={SMALL_BUTTON}>
          Undo
        </button>
      )}
    </div>
  );
}
