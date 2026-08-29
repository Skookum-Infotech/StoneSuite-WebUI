import { useCallback, useRef, useState } from 'react';
import { AlertCircle, File as FileIcon, FileSpreadsheet, FileText, Image as ImageIcon, X } from 'lucide-react';
import { MAX_FEEDBACK_ATTACHMENTS, formatFeedbackFileSize, validateFeedbackFile } from '@/lib/feedback';
import { cn } from '@/lib/utils';

type FileTypeConfig = { color: string; bg: string; Icon: React.ElementType };

function fileTypeConfig(fileName: string, contentType: string): FileTypeConfig {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf' || contentType === 'application/pdf') {
    return { color: 'text-file-pdf-text', bg: 'bg-file-pdf-bg', Icon: FileText };
  }
  if (ext === 'docx' || contentType.includes('wordprocessingml')) {
    return { color: 'text-file-doc-text', bg: 'bg-file-doc-bg', Icon: FileText };
  }
  if (ext === 'xlsx' || contentType.includes('spreadsheetml')) {
    return { color: 'text-file-sheet-text', bg: 'bg-file-sheet-bg', Icon: FileSpreadsheet };
  }
  if (['png', 'jpg', 'jpeg'].includes(ext) || contentType.startsWith('image/')) {
    return { color: 'text-file-image-text', bg: 'bg-file-image-bg', Icon: ImageIcon };
  }
  return { color: 'text-stone-500', bg: 'bg-stone-100 dark:bg-white/10', Icon: FileIcon };
}

// Staged file picker for the Submit screen — files are only validated and
// held locally (`files`/`onFilesChange`, owned by FeedbackSubmitForm) until
// the ticket itself is created; FeedbackSubmitForm then presigns/uploads/
// confirms each one against the new ticket's id. There is no per-file
// progress here — nothing uploads until Submit is pressed, so this is just
// a validated pick-and-remove list, unlike the record-attachment picker.
export function FeedbackAttachmentPicker({
  files,
  onFilesChange,
  disabled = false,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const addFiles = useCallback((incoming: File[]) => {
    const room = MAX_FEEDBACK_ATTACHMENTS - files.length;
    const errors: string[] = [];
    const valid: File[] = [];
    incoming.forEach((f, i) => {
      if (i >= room) {
        errors.push(`${f.name}: Maximum ${MAX_FEEDBACK_ATTACHMENTS} files per ticket.`);
        return;
      }
      const err = validateFeedbackFile(f);
      if (err) errors.push(err); else valid.push(f);
    });
    setValidationErrors(errors);
    if (valid.length > 0) onFilesChange([...files, ...valid]);
  }, [files, onFilesChange]);

  const removeFile = (index: number): void => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const onDragEnter = (e: React.DragEvent): void => { e.preventDefault(); dragCounter.current++; setDragging(true); };
  const onDragLeave = (e: React.DragEvent): void => { e.preventDefault(); if (--dragCounter.current === 0) setDragging(false); };
  const onDragOver = (e: React.DragEvent): void => { e.preventDefault(); };
  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault(); dragCounter.current = 0; setDragging(false);
    if (!disabled) addFiles(Array.from(e.dataTransfer.files));
  };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  const atLimit = files.length >= MAX_FEEDBACK_ATTACHMENTS;

  return (
    <div className="space-y-2.5">
      {!atLimit && (
        <div
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label="Attach a screenshot or file"
          onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileInputRef.current?.click(); } }}
          className={cn(
            'relative rounded-[10px] border-2 border-dashed px-4 py-4 text-center transition-all duration-150 group',
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
            dragging
              ? 'border-brand bg-brand/5'
              : 'border-stone-300 bg-white hover:border-stone-400 hover:bg-stone-50/50 dark:border-white/15 dark:bg-transparent dark:hover:bg-white/[0.04]',
          )}
        >
          <input
            ref={fileInputRef} type="file" multiple aria-hidden="true" tabIndex={-1} disabled={disabled}
            accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg" className="sr-only" onChange={onFileChange}
          />
          <p className="text-2xs font-medium text-stone-600 dark:text-stone-300">
            {dragging ? 'Release to attach' : 'Drop a screenshot or file, or click to browse'}
          </p>
          <p className="mt-0.5 text-2xs text-stone-400">
            PDF, DOCX, XLSX, PNG, JPG · Max {MAX_FEEDBACK_ATTACHMENTS} files, 25 MB each
          </p>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="space-y-1 rounded-lg border border-destructive/15 bg-destructive/5 px-3 py-2">
          {validationErrors.map((e) => (
            <div key={e} className="flex items-start gap-1.5">
              <AlertCircle className="mt-0.5 size-3 shrink-0 text-destructive/70" />
              <p className="text-2xs text-destructive">{e}</p>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-100 dark:divide-white/5 dark:border-white/10">
          {files.map((file, i) => {
            const ft = fileTypeConfig(file.name, file.type);
            return (
              <li key={`${file.name}-${file.size}-${i}`} className="flex items-center gap-2.5 px-3 py-2">
                <div className={cn('flex size-6 shrink-0 items-center justify-center rounded', ft.bg)}>
                  <ft.Icon className={cn('size-3.5', ft.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-2xs font-medium text-stone-700 dark:text-stone-200">{file.name}</p>
                  <span className="text-2xs text-stone-400">{formatFeedbackFileSize(file.size)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  disabled={disabled}
                  aria-label={`Remove ${file.name}`}
                  className="shrink-0 text-stone-300 hover:text-stone-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
