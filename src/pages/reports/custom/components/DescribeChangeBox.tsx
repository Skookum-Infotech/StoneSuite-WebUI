import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { apiErrorMessage } from "@/api/tenantClient";
import { Input } from "@/components/ui/input";
import { promptByteLength } from "@/lib/customReportDefinition";
import { customReportsService } from "@/services/customReportsService";
import {
  CUSTOM_PROMPT_MAX_BYTES,
  type CustomReportDefinition,
  type CustomReportInterpretation,
} from "@/types/customReports";
import { InterpretationNote } from "./InterpretationNote";
import { PRIMARY_BUTTON } from "./builderStyles";

interface DescribeChangeBoxProps {
  /** The report as it is now; sent so the assistant edits it rather than starting over. */
  current: CustomReportDefinition;
  /** Called with the assistant's changed report. */
  onApply: (interpretation: CustomReportInterpretation) => void;
  /** Called with the report as it was before the last change. */
  onUndo: (previous: CustomReportDefinition) => void;
}

const LABEL = "Describe a change";
const TOO_LONG_TEXT = "Please shorten your request.";
const TOO_LONG_ID = "describe-change-too-long";
const WAITING_TEXT = "Working on it… the first request can take up to a minute while the assistant wakes up.";
const ERROR_FALLBACK = "Could not apply that change.";

interface AppliedChange {
  interpretation: CustomReportInterpretation;
  previous: CustomReportDefinition;
}

/** "Only paid invoices": asks the assistant to change the open report, shows
 *  what it understood, and can put the report back. The builder keeps working
 *  by hand whatever the assistant does. */
export function DescribeChangeBox({ current, onApply, onUndo }: DescribeChangeBoxProps) {
  const [prompt, setPrompt] = useState("");
  const [applied, setApplied] = useState<AppliedChange | null>(null);

  const change = useMutation({
    mutationFn: (text: string) => customReportsService.interpret(text, current),
    onSuccess: (interpretation) => {
      setApplied({ interpretation, previous: current });
      setPrompt("");
      onApply(interpretation);
    },
  });
  const tooLong = promptByteLength(prompt) > CUSTOM_PROMPT_MAX_BYTES;
  const canSubmit = prompt.trim() !== "" && !tooLong && !change.isPending;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canSubmit) change.mutate(prompt.trim());
  }

  function handleUndo() {
    if (!applied) return;
    onUndo(applied.previous);
    setApplied(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-violet-500" aria-hidden="true" />
        <Input
          aria-label={LABEL}
          aria-invalid={tooLong}
          aria-describedby={tooLong ? TOO_LONG_ID : undefined}
          value={prompt}
          disabled={change.isPending}
          placeholder="Describe a change, e.g. only paid invoices"
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button type="submit" aria-label="Apply change" disabled={!canSubmit} className={PRIMARY_BUTTON}>
          Apply
        </button>
      </form>
      {tooLong && (
        <p id={TOO_LONG_ID} role="alert" className="text-xs text-red-700">
          {TOO_LONG_TEXT}
        </p>
      )}
      {change.isPending && (
        <p role="status" className="text-xs text-stone-500">
          {WAITING_TEXT}
        </p>
      )}
      {change.isError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {apiErrorMessage(change.error, ERROR_FALLBACK)}
        </p>
      )}
      {applied && (
        <InterpretationNote summary={applied.interpretation.summary} dropped={applied.interpretation.dropped} onUndo={handleUndo} />
      )}
    </div>
  );
}
