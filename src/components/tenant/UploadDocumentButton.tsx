import { useId, useRef, type ChangeEvent } from 'react';
import { Info, Upload } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { DOCUMENT_ACCEPT_ATTRIBUTE, validateDocumentFile } from '@/lib/documentUploadValidation';

interface UploadDocumentButtonProps {
  /** What is being uploaded, e.g. "Sales Order" — the button reads "Upload Sales Order". */
  documentLabel: string;
  /** Receives the picked file once it has passed client-side validation. */
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  /** Why the button is disabled — behind an info button beside it (hover, tap
   *  or keyboard) and announced with the button; it never takes toolbar space. */
  disabledReason?: string;
}

/** Opens the system file picker for a Sales Order / Purchase Order / Vendor
 *  Bill document. It only picks and validates the file — what happens to it
 *  next (upload, extraction, …) is up to the caller's `onFileSelected`. Styled
 *  to sit in a list-table toolbar next to "Download CSV". */
export function UploadDocumentButton({
  documentLabel, onFileSelected, disabled = false, disabledReason,
}: UploadDocumentButtonProps) {
  const reasonId = useId();
  const showReason = disabled && Boolean(disabledReason);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    e.target.value = '';
    if (!file) return;
    const error = validateDocumentFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    onFileSelected(file);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        title={showReason ? disabledReason : undefined}
        aria-describedby={showReason ? reasonId : undefined}
        aria-label={`Upload ${documentLabel} file`}
        className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 h-8 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Upload className="size-3.5" aria-hidden="true" />
        {`Upload ${documentLabel}`}
      </button>
      {showReason && (
        <>
          <span id={reasonId} className="sr-only">{disabledReason}</span>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                title={disabledReason}
                aria-label={`Why is Upload ${documentLabel} unavailable?`}
                className="inline-flex size-6 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-white/10"
              >
                <Info className="size-3.5" aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3 text-xs text-stone-700 dark:text-stone-300">
              {disabledReason}
            </PopoverContent>
          </Popover>
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={DOCUMENT_ACCEPT_ATTRIBUTE}
        aria-hidden="true"
        tabIndex={-1}
        disabled={disabled}
        className="sr-only"
        onChange={handleChange}
      />
    </span>
  );
}
