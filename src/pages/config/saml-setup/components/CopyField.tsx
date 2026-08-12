import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyFieldProps {
  label: string;
  value: string;
}

export function CopyField({ label, value }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-2xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
        <p className="mt-0.5 truncate font-mono text-xs text-stone-700" title={value}>
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${label}`}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-2xs font-semibold text-stone-600 transition hover:bg-stone-100"
      >
        {copied ? (
          <>
            <Check className="size-3.5 text-green-600" />
            Copied
          </>
        ) : (
          <>
            <Copy className="size-3.5" />
            Copy
          </>
        )}
      </button>
    </div>
  );
}
