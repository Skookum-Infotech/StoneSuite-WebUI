import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { importService } from '@/services/importService';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote } from '@/components/tenant/ui';
import { cn } from '@/lib/utils';
import { IMPORT_ALLOWED_EXT, importFileExt, validateImportFile } from './importConstants';

interface Props {
  workflowKey: string;
  onStaged: (jobId: string) => void;
}

/** Upload -> presign -> PUT to R2 -> create job (no column mapping yet — that
 *  happens during review, once the worker has parsed the file and staged raw
 *  rows: see ImportReviewStep and lib/importMapping.ts). */
export function ImportUploadStep({ workflowKey, onStaged }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const startImport = async (file: File) => {
    const validation = validateImportFile(file);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setBusy(true);
    setProgress(0);
    try {
      const ext = importFileExt(file.name);
      const contentType = IMPORT_ALLOWED_EXT[ext];
      const { storageKey, uploadUrl } = await importService.presign(workflowKey, {
        fileName: file.name,
        contentType,
        sizeBytes: file.size,
      });
      await importService.uploadToR2(uploadUrl, file, contentType, setProgress);
      const jobId = await importService.createJob(workflowKey, storageKey, file.name);
      onStaged(jobId);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to start the import.'));
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void startImport(file);
  };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void startImport(file);
  };

  return (
    <div className="space-y-3">
      <div
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => !busy && fileInputRef.current?.click()}
        className={cn(
          'relative rounded-lg border-2 border-dashed px-6 py-10 text-center transition-all duration-200 group',
          busy ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
          dragging
            ? 'border-stone-500 bg-stone-50 scale-[1.01] dark:bg-white/[0.04]'
            : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50 dark:border-stone-700 dark:bg-stone-900',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={Object.keys(IMPORT_ALLOWED_EXT).join(',')}
          className="sr-only"
          disabled={busy}
          onChange={onFileChange}
        />
        <div
          className={cn(
            'mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full transition-colors',
            dragging ? 'bg-stone-200' : 'bg-stone-100 group-hover:bg-stone-200 dark:bg-stone-800',
          )}
        >
          {busy ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin text-stone-500" />
          ) : (
            <Upload className="h-4.5 w-4.5 text-stone-400 group-hover:text-stone-600" />
          )}
        </div>
        <p className="mb-1 text-xs font-medium text-stone-600 dark:text-stone-300">
          {busy ? `Uploading… ${progress}%` : dragging ? 'Release to upload' : 'Drop a file here or click to browse'}
        </p>
        <p className="flex items-center justify-center gap-1 text-2xs text-stone-400">
          <FileSpreadsheet className="size-3" /> CSV, XLSX, DOCX, or PDF — up to 25 MB
        </p>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}
