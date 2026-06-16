import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Upload, FileText, FileSpreadsheet, Image, File,
  Download, Trash2, AlertCircle, CheckCircle2, Loader2,
  CloudUpload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { crmService, type AuditEntry } from '@/services/crmService';
import { attachmentService, type Attachment } from '@/services/attachmentService';
import { Spinner } from '@/components/tenant/ui';
import { apiErrorMessage } from '@/api/tenantClient';

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = { readonly key: string; readonly label: string };

type Props = {
  tabs: readonly Tab[];
  readOnly?: boolean;
  recordId?: string;
  workflowKey?: string;
};

type UploadItem = {
  id: string;
  file: File;
  progress: number;
  // 'staged' = waiting for a recordId (create-form mode); 'queued' = about to upload
  status: 'staged' | 'queued' | 'uploading' | 'confirming' | 'done' | 'error';
  error?: string;
};

// ── Public handle exposed to add-form pages ───────────────────────────────────

export type EditableFilesPanelHandle = {
  hasStagedFiles: () => boolean;
  /** Upload all staged files to the newly created record; resolves when all done. */
  uploadStagedTo: (recordId: string) => Promise<void>;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};
const ALLOWED_EXTS = ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES[file.type] && !ALLOWED_EXTS.some((e) => file.name.toLowerCase().endsWith(e))) {
    return `${file.name}: Unsupported type. Allowed: PDF, DOCX, XLSX, PNG, JPG`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `${file.name}: Exceeds 25 MB limit`;
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── File type visuals ────────────────────────────────────────────────────────

type FileTypeConfig = { label: string; color: string; bg: string; Icon: React.ElementType };

function getFileType(fileName: string, contentType?: string): FileTypeConfig {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const mime = contentType ?? '';
  if (ext === 'pdf' || mime === 'application/pdf')
    return { label: 'PDF', color: 'text-rose-600', bg: 'bg-rose-50', Icon: FileText };
  if (ext === 'docx' || mime.includes('wordprocessingml'))
    return { label: 'DOCX', color: 'text-blue-600', bg: 'bg-blue-50', Icon: FileText };
  if (ext === 'xlsx' || mime.includes('spreadsheetml'))
    return { label: 'XLSX', color: 'text-emerald-600', bg: 'bg-emerald-50', Icon: FileSpreadsheet };
  if (['png', 'jpg', 'jpeg'].includes(ext) || mime.startsWith('image/'))
    return { label: ext.toUpperCase(), color: 'text-amber-600', bg: 'bg-amber-50', Icon: Image };
  return { label: ext.toUpperCase() || 'FILE', color: 'text-stone-500', bg: 'bg-stone-100', Icon: File };
}

// ── Main panel ───────────────────────────────────────────────────────────────

export function CrmSubTabsPanel({ tabs, readOnly = true, recordId, workflowKey }: Props) {
  const [active, setActive] = useState<string>(tabs[0]?.key ?? '');

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="flex border-b border-stone-100 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={cn(
              'px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors',
              active === tab.key
                ? 'border-stone-800 text-stone-800'
                : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-300',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-5 py-4">
        {active === 'transactions' && <TransactionsContent />}
        {active === 'audit' && <AuditContent recordId={recordId} workflowKey={workflowKey} />}
        {active === 'files' && (
          <FilesContent recordId={recordId} readOnly={readOnly} />
        )}
      </div>
    </div>
  );
}

// ── Standalone editable files panel (used in edit forms) ─────────────────────

type EditableFilesPanelProps = { recordId?: string };

export const EditableFilesPanel = forwardRef<EditableFilesPanelHandle, EditableFilesPanelProps>(
  ({ recordId }, ref) => {
    const innerRef = useRef<EditableFilesPanelHandle>(null);

    useImperativeHandle(ref, () => ({
      hasStagedFiles: () => innerRef.current?.hasStagedFiles() ?? false,
      uploadStagedTo: (id) => innerRef.current?.uploadStagedTo(id) ?? Promise.resolve(),
    }));

    return (
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3 border-b border-stone-100">
          <div className="w-1 h-4 rounded-full shrink-0 bg-teal-400" />
          <h3 className="text-xs font-semibold text-stone-700">Files</h3>
        </div>
        <div className="px-5 py-4">
          <FilesContent ref={innerRef} recordId={recordId} readOnly={false} />
        </div>
      </div>
    );
  },
);
EditableFilesPanel.displayName = 'EditableFilesPanel';

// ── Transactions tab ──────────────────────────────────────────────────────────

function TransactionsContent() {
  return (
    <p className="py-6 text-center text-xs text-stone-400 italic">No transactions yet.</p>
  );
}

// ── Audit tab ─────────────────────────────────────────────────────────────────

function AuditContent({ recordId, workflowKey }: { recordId?: string; workflowKey?: string }) {
  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ['record-audit', recordId],
    queryFn: () => crmService.getRecordAudit(recordId ?? '', workflowKey),
    enabled: Boolean(recordId),
  });

  if (!recordId)
    return <p className="py-6 text-center text-xs text-stone-400 italic">No audit events recorded yet.</p>;
  if (isLoading)
    return <div className="py-6 flex justify-center"><Spinner label="Loading audit trail…" /></div>;
  if (error)
    return <p className="py-6 text-center text-xs text-red-400 italic">Failed to load audit trail.</p>;
  if (entries.length === 0)
    return <p className="py-6 text-center text-xs text-stone-400 italic">No audit events recorded yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-stone-100">
            {['Action', 'Resource', 'Actor', 'IP Address', 'Version', 'Date'].map((h) => (
              <th key={h} className="py-2 pr-4 text-left font-semibold uppercase tracking-wide text-stone-400 text-2xs whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => <AuditRow key={i} entry={entry} />)}
        </tbody>
      </table>
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasChanges = Boolean(entry.oldValue || entry.newValue);

  return (
    <>
      <tr
        className={cn('border-b border-stone-50 transition-colors', hasChanges && 'cursor-pointer hover:bg-stone-50')}
        onClick={() => hasChanges && setExpanded((v) => !v)}
      >
        <td className="py-2.5 pr-4"><ActionBadge action={entry.action} /></td>
        <td className="py-2.5 pr-4 text-stone-600 capitalize">{entry.resource}</td>
        <td className="py-2.5 pr-4 text-stone-500 font-mono text-2xs">{entry.actorUserId || <span className="text-stone-300 italic">system</span>}</td>
        <td className="py-2.5 pr-4 text-stone-400 font-mono text-2xs">{entry.ipAddress || '—'}</td>
        <td className="py-2.5 pr-4 text-stone-400 text-2xs">{entry.appVersion || '—'}</td>
        <td className="py-2.5 text-stone-400 text-2xs whitespace-nowrap">
          {new Date(entry.at).toLocaleString()}
          {hasChanges && <span className="ml-1.5 text-stone-300">{expanded ? '▲' : '▼'}</span>}
        </td>
      </tr>
      {expanded && hasChanges && (
        <tr className="bg-stone-50">
          <td colSpan={6} className="px-2 pb-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              {entry.oldValue && <ChangesBlock label="Before" data={entry.oldValue} />}
              {entry.newValue && <ChangesBlock label="After" data={entry.newValue} />}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ActionBadge({ action }: { action: string }) {
  const color =
    action === 'create' ? 'bg-emerald-50 text-emerald-700' :
    action === 'delete' ? 'bg-red-50 text-red-600' :
    action === 'update' ? 'bg-blue-50 text-blue-700' :
    'bg-stone-100 text-stone-600';
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-semibold capitalize', color)}>
      {action}
    </span>
  );
}

function ChangesBlock({ label, data }: { label: string; data: Record<string, unknown> }) {
  const entries = flattenChanges(data);
  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-wide text-stone-400 mb-1.5">{label}</p>
      <div className="space-y-0.5">
        {entries.map(([key, val]) => (
          <div key={key} className="flex gap-2 text-2xs">
            <span className="text-stone-400 shrink-0 min-w-[80px] font-medium">{key}</span>
            <span className="text-stone-600 break-all">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function flattenChanges(obj: Record<string, unknown>, prefix = ''): [string, string][] {
  const result: [string, string][] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      result.push(...flattenChanges(v as Record<string, unknown>, key));
    } else {
      result.push([key, v === null || v === undefined ? '—' : String(v)]);
    }
  }
  return result;
}

// ── Files tab ─────────────────────────────────────────────────────────────────

type FilesContentProps = { recordId?: string; readOnly: boolean };

const FilesContent = forwardRef<EditableFilesPanelHandle, FilesContentProps>(
  ({ recordId, readOnly }, ref) => {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const dragCounter = useRef(0);
    // Keep a ref-copy of uploadQueue so imperative handle can read it synchronously
    const uploadQueueRef = useRef<UploadItem[]>([]);

    const { data: attachments = [], isLoading } = useQuery({
      queryKey: ['record-attachments', recordId],
      queryFn: () => attachmentService.listAttachments(recordId ?? ''),
      enabled: Boolean(recordId),
    });

    const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
      setUploadQueue((prev) => {
        const next = prev.map((item) => item.id === id ? { ...item, ...patch } : item);
        uploadQueueRef.current = next;
        return next;
      });
    }, []);

    // Core upload runner — takes a list of items + a target recordId
    const runUploads = useCallback(async (items: UploadItem[], targetId: string) => {
      let presigned;
      try {
        presigned = await attachmentService.presignBatch(
          targetId,
          items.map((it) => ({ fileName: it.file.name, contentType: it.file.type, sizeBytes: it.file.size })),
        );
      } catch (err) {
        items.forEach((it) => updateItem(it.id, { status: 'error', error: apiErrorMessage(err, 'Failed to prepare upload') }));
        return;
      }

      await Promise.all(
        presigned.map(async (p, i) => {
          updateItem(items[i].id, { status: 'uploading' });
          try {
            await attachmentService.uploadToR2(p.uploadUrl, items[i].file, (pct) => {
              updateItem(items[i].id, { progress: pct });
            });
            updateItem(items[i].id, { status: 'confirming', progress: 100 });
          } catch (err) {
            updateItem(items[i].id, { status: 'error', error: apiErrorMessage(err, 'Upload failed') });
          }
        }),
      );

      const successIdx = presigned.map((_, i) => i).filter(
        (i) => uploadQueueRef.current.find((it) => it.id === items[i].id)?.status === 'confirming',
      );
      if (successIdx.length === 0) return;

      try {
        await attachmentService.confirmAttachments(
          targetId,
          successIdx.map((i) => ({
            fileName: presigned[i].fileName,
            contentType: items[i].file.type,
            sizeBytes: items[i].file.size,
            storageKey: presigned[i].storageKey,
            checksumSha256: '',
          })),
        );
        successIdx.forEach((i) => updateItem(items[i].id, { status: 'done' }));
        queryClient.invalidateQueries({ queryKey: ['record-attachments', targetId] });
        setTimeout(() => {
          setUploadQueue((prev) => {
            const next = prev.filter((it) => it.status !== 'done');
            uploadQueueRef.current = next;
            return next;
          });
        }, 1800);
      } catch (err) {
        successIdx.forEach((i) => updateItem(items[i].id, { status: 'error', error: apiErrorMessage(err, 'Failed to confirm') }));
      }
    }, [updateItem, queryClient]);

    // ── Expose imperative handle to parent add-forms ──────────────────────────

    useImperativeHandle(ref, () => ({
      hasStagedFiles: () => uploadQueueRef.current.some((it) => it.status === 'staged'),
      uploadStagedTo: async (id: string) => {
        const staged = uploadQueueRef.current.filter((it) => it.status === 'staged');
        if (staged.length === 0) return;
        await runUploads(staged, id);
      },
    }), [runUploads]);

    // ── File intake ───────────────────────────────────────────────────────────

    const addFiles = useCallback((files: File[]) => {
      const errors: string[] = [];
      const valid: File[] = [];
      files.forEach((f) => {
        const err = validateFile(f);
        if (err) errors.push(err); else valid.push(f);
      });
      setValidationErrors(errors);
      if (valid.length === 0) return;

      const items: UploadItem[] = valid.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        progress: 0,
        // If we have a recordId, upload immediately; otherwise stage until save
        status: recordId ? 'queued' : 'staged',
      }));
      setUploadQueue((prev) => {
        const next = [...prev, ...items];
        uploadQueueRef.current = next;
        return next;
      });

      if (recordId) {
        void runUploads(items, recordId);
      }
    }, [recordId, runUploads]);

    const onDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current++; setDragging(true); };
    const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); if (--dragCounter.current === 0) setDragging(false); };
    const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); };
    const onDrop = (e: React.DragEvent) => {
      e.preventDefault(); dragCounter.current = 0; setDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    };
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      addFiles(Array.from(e.target.files ?? []));
      e.target.value = '';
    };

    const handleDownload = async (att: Attachment) => {
      if (!recordId) return;
      setDownloadingId(att.id);
      try {
        const { downloadUrl, fileName } = await attachmentService.downloadAttachment(recordId, att.id);
        const a = document.createElement('a');
        a.href = downloadUrl; a.download = fileName; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.click();
      } catch { /* silent */ } finally { setDownloadingId(null); }
    };

    const handleDelete = async (att: Attachment) => {
      if (!recordId) return;
      setDeletingId(att.id);
      try {
        await attachmentService.deleteAttachment(recordId, att.id);
        queryClient.invalidateQueries({ queryKey: ['record-attachments', recordId] });
      } catch { /* silent */ } finally { setDeletingId(null); }
    };

    const activeUploads = uploadQueue.filter((it) => it.status !== 'done');
    const stagedCount = activeUploads.filter((it) => it.status === 'staged').length;
    const isUploading = activeUploads.some((it) => it.status === 'uploading' || it.status === 'confirming');

    return (
      <div className="space-y-4">

        {/* Drop zone */}
        {!readOnly && (
          <div
            onDragEnter={onDragEnter} onDragLeave={onDragLeave}
            onDragOver={onDragOver}  onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'relative rounded-lg border-2 border-dashed px-6 py-7 text-center transition-all duration-200 cursor-pointer group',
              dragging
                ? 'border-stone-500 bg-stone-50 scale-[1.01]'
                : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50',
            )}
          >
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
              className="sr-only" onChange={onFileChange} />
            <div className={cn(
              'inline-flex items-center justify-center w-10 h-10 rounded-full mb-3 transition-colors',
              dragging ? 'bg-stone-200' : 'bg-stone-100 group-hover:bg-stone-200',
            )}>
              <Upload className={cn('h-4.5 w-4.5 transition-colors', dragging ? 'text-stone-700' : 'text-stone-400 group-hover:text-stone-600')} />
            </div>
            <p className="text-xs font-medium text-stone-600 mb-1">
              {dragging ? 'Release to add' : 'Drop files here or click to browse'}
            </p>
            <p className="text-2xs text-stone-400">PDF, DOCX, XLSX, PNG, JPG · Max 25 MB each</p>
            {!recordId && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-100 px-3 py-1">
                <CloudUpload className="h-3 w-3 text-amber-500" />
                <span className="text-2xs text-amber-700 font-medium">Files will upload automatically when you save</span>
              </div>
            )}
          </div>
        )}

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 space-y-1">
            {validationErrors.map((e, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{e}</p>
              </div>
            ))}
            <button type="button" onClick={() => setValidationErrors([])}
              className="text-2xs text-red-400 hover:text-red-600 mt-1">Dismiss</button>
          </div>
        )}

        {/* Upload / staged queue */}
        {activeUploads.length > 0 && (
          <div className="rounded-lg border border-stone-100 bg-stone-50/60 divide-y divide-stone-100 overflow-hidden">
            <div className="px-4 py-2 flex items-center gap-1.5">
              {stagedCount > 0 && !isUploading ? (
                <>
                  <CloudUpload className="h-3 w-3 text-amber-400" />
                  <span className="text-2xs font-semibold uppercase tracking-wide text-amber-500">
                    {stagedCount} file{stagedCount > 1 ? 's' : ''} queued · uploads on save
                  </span>
                </>
              ) : (
                <>
                  <Loader2 className="h-3 w-3 text-stone-400 animate-spin" />
                  <span className="text-2xs font-semibold uppercase tracking-wide text-stone-400">Uploading</span>
                </>
              )}
            </div>
            {activeUploads.map((item) => (
              <UploadProgressRow key={item.id} item={item} onDismiss={() => {
                setUploadQueue((prev) => {
                  const next = prev.filter((it) => it.id !== item.id);
                  uploadQueueRef.current = next;
                  return next;
                });
              }} />
            ))}
          </div>
        )}

        {/* Existing attachments list */}
        {isLoading ? (
          <div className="py-4 flex justify-center"><Spinner label="Loading files…" /></div>
        ) : attachments.length > 0 ? (
          <div className="rounded-lg border border-stone-100 overflow-hidden divide-y divide-stone-50">
            {attachments.map((att) => (
              <AttachmentRow
                key={att.id} att={att}
                isDownloading={downloadingId === att.id}
                isDeleting={deletingId === att.id}
                readOnly={readOnly}
                onDownload={() => handleDownload(att)}
                onDelete={() => handleDelete(att)}
              />
            ))}
          </div>
        ) : activeUploads.length === 0 ? (
          <p className="py-4 text-center text-xs text-stone-400 italic">No files attached yet.</p>
        ) : null}

      </div>
    );
  },
);
FilesContent.displayName = 'FilesContent';

// ── Upload progress row ───────────────────────────────────────────────────────

function UploadProgressRow({ item, onDismiss }: { item: UploadItem; onDismiss: () => void }) {
  const ft = getFileType(item.file.name, item.file.type);

  const statusLabel =
    item.status === 'error'     ? 'Failed'   :
    item.status === 'confirming'? 'Saving…'  :
    item.status === 'uploading' ? `${item.progress}%` :
    item.status === 'staged'    ? 'On save'  :
    'Queued';

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Icon */}
      <div className={cn('flex items-center justify-center w-7 h-7 rounded shrink-0', ft.bg)}>
        <ft.Icon className={cn('h-3.5 w-3.5', ft.color)} />
      </div>

      {/* Info + progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-stone-700 truncate pr-2">{item.file.name}</p>
          <span className={cn(
            'text-2xs shrink-0',
            item.status === 'error' ? 'text-red-500' : 'text-stone-400',
          )}>
            {statusLabel}
          </span>
        </div>
        {item.status === 'error' ? (
          <p className="text-2xs text-red-500 truncate">{item.error ?? 'Upload failed'}</p>
        ) : item.status === 'staged' ? (
          <div className="h-1 rounded-full bg-amber-100">
            <div className="h-full w-1/3 rounded-full bg-amber-300 animate-pulse" />
          </div>
        ) : (
          <div className="h-1 rounded-full bg-stone-200 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                item.status === 'confirming' ? 'bg-amber-400 animate-pulse' : 'bg-stone-700',
              )}
              style={{ width: `${item.status === 'confirming' ? 100 : item.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Dismiss on error */}
      {item.status === 'error' && (
        <button type="button" onClick={onDismiss} className="text-stone-300 hover:text-stone-500 transition-colors">
          <span className="sr-only">Dismiss</span>
          <span aria-hidden>×</span>
        </button>
      )}
    </div>
  );
}

// ── Existing attachment row ───────────────────────────────────────────────────

type AttachmentRowProps = {
  att: Attachment;
  isDownloading: boolean;
  isDeleting: boolean;
  readOnly: boolean;
  onDownload: () => void;
  onDelete: () => void;
};

function AttachmentRow({ att, isDownloading, isDeleting, readOnly, onDownload, onDelete }: AttachmentRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ft = getFileType(att.fileName, att.contentType);

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50/60 transition-colors group">
      {/* Type badge */}
      <div className={cn('flex items-center justify-center w-7 h-7 rounded shrink-0', ft.bg)}>
        <ft.Icon className={cn('h-3.5 w-3.5', ft.color)} />
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-stone-700 truncate">{att.fileName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('text-2xs font-semibold px-1 rounded', ft.bg, ft.color)}>{ft.label}</span>
          <span className="text-2xs text-stone-400">{formatBytes(att.sizeBytes)}</span>
          {att.createdAt && (
            <>
              <span className="text-2xs text-stone-300">·</span>
              <span className="text-2xs text-stone-400">{formatDate(att.createdAt)}</span>
            </>
          )}
          {att.status === 'infected' && (
            <span className="text-2xs text-red-500 font-medium flex items-center gap-0.5">
              <AlertCircle className="h-3 w-3" /> Infected
            </span>
          )}
          {att.status === 'clean' && (
            <span className="text-2xs text-emerald-500 flex items-center gap-0.5">
              <CheckCircle2 className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Download */}
        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloading || att.status === 'infected'}
          className="flex items-center gap-1 px-2 py-1.5 rounded text-2xs text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Download"
        >
          {isDownloading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Download className="h-3.5 w-3.5" />}
        </button>

        {/* Delete — only when not readOnly */}
        {!readOnly && (
          confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                className="px-2 py-1.5 rounded text-2xs text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1.5 rounded text-2xs text-stone-500 hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 px-2 py-1.5 rounded text-2xs text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )
        )}
      </div>
    </div>
  );
}
