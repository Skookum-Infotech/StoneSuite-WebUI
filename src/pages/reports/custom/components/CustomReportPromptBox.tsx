import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { apiErrorMessage } from "@/api/tenantClient";
import { promptByteLength } from "@/lib/customReportDefinition";
import { customReportsService } from "@/services/customReportsService";
import { CUSTOM_PROMPT_MAX_BYTES, type CustomReportInterpretation } from "@/types/customReports";

interface CustomReportPromptBoxProps {
  /** Called with what the assistant understood, so the page can open the builder on it. */
  onInterpreted: (interpretation: CustomReportInterpretation) => void;
}

const EXAMPLE_PROMPTS = [
  "Top 10 customers by invoice revenue this quarter",
  "Open purchase orders by vendor",
  "Leads created per month by source this year",
  "Stock on hand by location",
];

const PROMPT_LABEL = "Describe the report you want";
const TOO_LONG_TEXT = "Please shorten your request.";
const WAITING_TEXT = "Building your report… the first request can take up to a minute while the assistant wakes up.";
const ERROR_FALLBACK = "Could not build the report from that description.";
const MANUAL_PATH = "/reports/custom/new";
const TOO_LONG_ID = "custom-report-prompt-too-long";

/** The plain-English box: describe a report, get a first version in the builder. */
export function CustomReportPromptBox({ onInterpreted }: CustomReportPromptBoxProps) {
  const [prompt, setPrompt] = useState("");
  const interpret = useMutation({
    mutationFn: (text: string) => customReportsService.interpret(text),
    onSuccess: onInterpreted,
  });
  const tooLong = promptByteLength(prompt) > CUSTOM_PROMPT_MAX_BYTES;
  const canSubmit = prompt.trim() !== "" && !tooLong && !interpret.isPending;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canSubmit) interpret.mutate(prompt.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
        <Sparkles className="size-4 text-violet-500" aria-hidden="true" />
        {PROMPT_LABEL}
      </h2>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <textarea
          aria-label={PROMPT_LABEL}
          aria-invalid={tooLong}
          aria-describedby={tooLong ? TOO_LONG_ID : undefined}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          placeholder="e.g. Top 10 customers by invoice revenue this quarter"
          className="min-h-[3rem] flex-1 resize-y rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
        />
        <button
          type="submit"
          aria-label="Build it"
          disabled={!canSubmit}
          className="h-9 self-start rounded-lg bg-stone-900 px-4 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
        >
          Build it
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Example requests">
        {EXAMPLE_PROMPTS.map((example) => (
          <button
            key={example}
            type="button"
            aria-label={example}
            onClick={() => setPrompt(example)}
            className="rounded-full border border-stone-200 px-3 py-1 text-xs text-stone-600 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          >
            {example}
          </button>
        ))}
      </div>
      {tooLong && (
        <p id={TOO_LONG_ID} role="alert" className="mt-2 text-xs text-red-700">
          {TOO_LONG_TEXT}
        </p>
      )}
      {interpret.isPending && (
        <p role="status" className="mt-2 text-xs text-stone-500">
          {WAITING_TEXT}
        </p>
      )}
      {interpret.isError && (
        <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {apiErrorMessage(interpret.error, ERROR_FALLBACK)}{" "}
          <Link to={MANUAL_PATH} aria-label="Start a report by hand" className="font-medium underline">
            Start a report by hand
          </Link>
        </p>
      )}
    </form>
  );
}
