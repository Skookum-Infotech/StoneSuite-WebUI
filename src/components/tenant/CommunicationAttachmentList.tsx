import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, FileX, Loader2, Paperclip } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { recordEmailService } from '@/services/recordEmailService';
import { NOT_KEPT_REASONS, formatFileSize } from '@/lib/recordEmail';
import type { RecordEmailAttachment } from '@/types/recordEmail';

const CHIP_BASE = 'inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-xs';

interface CommunicationAttachmentListProps {
  recordId: string;
  attachments: RecordEmailAttachment[];
  // Files the message had that have no entry here: it predates kept files.
  missingCount: number;
}

// The files that came with one message, under its text. A kept file is a button
// that downloads it; one still being copied says so; one that was not kept shows
// why, so nobody wonders where it went. Downloading asks the backend for a
// short-lived link (checked against the user's access to the record) and opens it,
// which forces a download rather than showing the file in the browser.
export function CommunicationAttachmentList({ recordId, attachments, missingCount }: CommunicationAttachmentListProps) {
  const download = useMutation({
    mutationFn: (attachment: RecordEmailAttachment) => recordEmailService.downloadAttachment(recordId, attachment.id),
    onSuccess: ({ downloadUrl, fileName }) => {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
    },
    onError: (err, attachment) => {
      toast.error(`Couldn't download ${attachment.fileName}: ${apiErrorMessage(err, 'please try again.')}`);
    },
  });
  const downloadingId = download.isPending ? download.variables.id : undefined;

  return (
    <div className="mt-3 space-y-2">
      {attachments.length > 0 && (
        <ul aria-label="Attachments" className="flex list-none flex-wrap gap-2">
          {attachments.map((a) => (
            <li key={a.id} className="max-w-full">
              {a.status === 'stored' ? (
                <button
                  type="button"
                  onClick={() => download.mutate(a)}
                  disabled={downloadingId === a.id}
                  aria-label={`Download ${a.fileName}`}
                  title={`Download ${a.fileName}`}
                  className={`${CHIP_BASE} border-stone-200 bg-stone-50 font-medium text-stone-700 transition-colors hover:border-stone-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-wait disabled:opacity-70`}
                >
                  {downloadingId === a.id ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
                  ) : (
                    <Paperclip className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
                  )}
                  <span className="truncate">{a.fileName}</span>
                  {a.sizeBytes > 0 && <span className="shrink-0 font-normal text-stone-400">{formatFileSize(a.sizeBytes)}</span>}
                  <Download className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
                </button>
              ) : a.status === 'pending' ? (
                <span title="This file is being copied and will be ready shortly." className={`${CHIP_BASE} border-dashed border-stone-200 text-stone-500`}>
                  <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
                  <span className="truncate">{a.fileName}</span>
                  <span className="shrink-0 text-stone-400">Copying…</span>
                </span>
              ) : (
                <span title={NOT_KEPT_REASONS[a.status].detail} className={`${CHIP_BASE} border-stone-100 bg-stone-50/60 text-stone-400`}>
                  <FileX className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{a.fileName}</span>
                  <span className="shrink-0">{NOT_KEPT_REASONS[a.status].label}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {missingCount > 0 && (
        <p className="text-xs italic text-stone-400">
          {missingCount === 1
            ? 'This email had 1 attachment that was not kept.'
            : `This email had ${missingCount} attachments that were not kept.`}
        </p>
      )}
    </div>
  );
}
