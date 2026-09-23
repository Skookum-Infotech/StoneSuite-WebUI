import { useRef, type ChangeEvent } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  ACCEPTED_DOCUMENT_EXTENSIONS,
  ACCEPTED_DOCUMENT_MIME_TYPES,
  validateDocumentFile,
} from '@/lib/documentUploadValidation';

const ACCEPT_ATTRIBUTE = [...ACCEPTED_DOCUMENT_EXTENSIONS, ...ACCEPTED_DOCUMENT_MIME_TYPES].join(',');

interface UploadDocumentButtonProps {
  /** What is being uploaded, e.g. "Sales Order" — the button reads "Upload Sales Order". */
  documentLabel: string;
  /** Receives the picked file once it has passed client-side validation. */
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

/** Opens the system file picker for a Sales Order / Purchase Order / Vendor
 *  Bill document. It only picks and validates the file — what happens to it
 *  next (upload, extraction, …) is up to the caller's `onFileSelected`. Styled
 *  to sit in a list-table toolbar next to "Download CSV". */
export function UploadDocumentButton({ documentLabel, onFileSelected, disabled = false }: UploadDocumentButtonProps) {
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
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        aria-label={`Upload ${documentLabel} file`}
        className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 h-8 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Upload className="size-3.5" aria-hidden="true" />
        {`Upload ${documentLabel}`}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        aria-hidden="true"
        tabIndex={-1}
        disabled={disabled}
        className="sr-only"
        onChange={handleChange}
      />
    </>
  );
}
