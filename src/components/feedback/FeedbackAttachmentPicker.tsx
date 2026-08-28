import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, FileSpreadsheet, Image as ImageIcon, File as FileIcon, AlertCircle, Loader2, X } from 'lucide-react';
import { feedbackService } from '@/services/feedbackService';
import { attachmentService } from '@/services/attachmentService';
import { apiErrorMessage } from '@/api/tenantClient';
import { MAX_FEEDBACK_ATTACHMENTS, formatFeedbackFileSize, validateFeedbackFile } from '@/lib/feedback';
import { cn } from '@/lib/utils';

type UploadItem = {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'confirming' | 'done' | 'error';
  error?: string;
};

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

// Attachment picker for an already-created feedback ticket: presign -> PUT
// to R2 -> confirm, immediately per file (unlike CrmSubTabsPanel's
// FilesContent, there is no "staged until save" mode here — the ticket
// already exists by the time this renders, see FeedbackSubmitForm).
export function FeedbackAttachmentPicker({ feedbackId }: { feedbackId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setQueue((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const uploadOne = useCallback(async (item: UploadItem) => {
    updateItem(item.id, { status: 'uploading' });
    try {
      const [presigned] = await feedbackService.presignAttachments(feedbackId, [
        { fileName: item.file.name, contentType: item.file.type, sizeBytes: item.file.size },
      ]);
      await attachmentService.uploadToR2(presigned.uploadUrl, item.file, (pct) => updateItem(item.id, { progress: pct }));
      updateItem(item.id, { status: 'confirming', progress: 100 });
      await feedbackService.confirmAttachments(feedbackId, [
        {
          fileName: presigned.fileName,
          contentType: item.file.type,
          sizeBytes: item.file.size,
          storageKey: presigned.storageKey,
          checksumSha256: '',
        },
      ]);
      updateItem(item.id, { status: 'done' });
    } catch (err) {
      updateItem(item.id, { status: 'error', error: apiErrorMessage(err, 'Upload failed') });
    }
  }, [feedbackId, updateItem]);

  const addFiles = useCallback((files: File[]) => {
    const room = MAX_FEEDBACK_ATTACHMENTS - queue.length;
    const errors: string[] = [];
    const valid: File[] = [];
    files.forEach((f, i) => {
      if (i >= room) {
        errors.push(`${f.name}: Maximum ${MAX_FEEDBACK_ATTACHMENTS} files per ticket.`);
        return;
      }
      const err = validateFeedbackFile(f);
      if (err) errors.push(err); else valid.push(f);
    });
    setValidationErrors(errors);
    if (valid.length === 0) return;

    const items: UploadItem[] = valid.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      status: 'uploading',
    }));
    setQueue((prev) => [...prev, ...items]);
    items.forEach((item) => void uploadOne(item));
  }, [queue.length, uploadOne]);

  const onDragEnter = (e: React.DragEvent): void => { e.preventDefault(); dragCounter.current++; setDragging(true); };
  const onDragLeave = (e: React.DragEvent): void => { e.preventDefault(); if (--dragCounter.current === 0) setDragging(false); };
  const onDragOver = (e: React.DragEvent): void => { e.preventDefault(); };
  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault(); dragCounter.current = 0; setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  const atLimit = queue.length >= MAX_FEEDBACK_ATTACHMENTS;

  return (
    <div className="space-y-2.5">
      {!atLimit && (
        <div
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Attach a screenshot or file"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
          className={cn(
            'relative rounded-[10px] border-2 border-dashed px-4 py-4 text-center transition-all duration-150 cursor-pointer group',
            dragging
              ? 'border-brand bg-brand/5'
              : 'border-stone-300 bg-white hover:border-stone-400 hover:bg-stone-50/50 dark:border-white/15 dark:bg-transparent dark:hover:bg-white/[0.04]',
          )}
        >
          <input
            ref={fileInputRef} type="file" multiple aria-hidden="true" tabIndex={-1}
            accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg" className="sr-only" onChange={onFileChange}
          />
          <Upload className="mx-auto mb-1.5 size-4 text-stone-400" aria-hidden="true" />
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

      {queue.length > 0 && (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-100 dark:divide-white/5 dark:border-white/10">
          {queue.map((item) => {
            const ft = fileTypeConfig(item.file.name, item.file.type);
            return (
              <li key={item.id} className="flex items-center gap-2.5 px-3 py-2">
                <div className={cn('flex size-6 shrink-0 items-center justify-center rounded', ft.bg)}>
                  <ft.Icon className={cn('size-3.5', ft.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-2xs font-medium text-stone-700 dark:text-stone-200">{item.file.name}</p>
                    <span className="shrink-0 text-2xs text-stone-400">{formatFeedbackFileSize(item.file.size)}</span>
                  </div>
                  {item.status === 'error' ? (
                    <p className="mt-0.5 truncate text-2xs text-destructive">{item.error}</p>
                  ) : item.status !== 'done' ? (
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
                      <div
                        className={cn('h-full rounded-full transition-all duration-300', item.status === 'confirming' ? 'animate-pulse bg-brand' : 'bg-stone-600 dark:bg-stone-400')}
                        style={{ width: `${item.status === 'confirming' ? 100 : item.progress}%` }}
                      />
                    </div>
                  ) : null}
                </div>
                {item.status === 'uploading' || item.status === 'confirming' ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-stone-400" aria-label="Uploading" />
                ) : item.status === 'error' ? (
                  <button
                    type="button"
                    onClick={() => setQueue((prev) => prev.filter((it) => it.id !== item.id))}
                    aria-label={`Remove ${item.file.name}`}
                    className="shrink-0 text-stone-300 hover:text-stone-500"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
