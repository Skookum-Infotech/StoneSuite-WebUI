// One uploaded DXF on the Drawing tab: its actions, then its drawing.

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/api/tenantClient';
import { attachmentService, type Attachment } from '@/services/attachmentService';
import { DxfDrawingBody } from './DxfDrawingBody';

const ACTION_CLASS = 'inline-flex items-center gap-1 rounded px-2 py-1 text-2xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50';

type Props = { orderId: string; attachment: Attachment; label: string; canEdit: boolean };

export function DxfFilePanel({ orderId, attachment, label, canEdit }: Props) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const download = useMutation({
    mutationFn: () => attachmentService.downloadAttachment(orderId, attachment.id),
    onSuccess: ({ downloadUrl, fileName }) => {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.rel = 'noopener noreferrer';
      link.click();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Download failed. Please try again.')),
  });

  const remove = useMutation({
    mutationFn: () => attachmentService.deleteAttachment(orderId, attachment.id),
    onSuccess: () => {
      toast.success(`${attachment.fileName} deleted`);
      return queryClient.invalidateQueries({ queryKey: ['record-attachments', orderId] });
    },
    onError: (err) => {
      setConfirming(false);
      toast.error(apiErrorMessage(err, 'Delete failed. Please try again.'));
    },
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          aria-label={`Download ${label}`}
          disabled={download.isPending || attachment.status === 'infected'}
          onClick={() => download.mutate()}
          className={ACTION_CLASS}
        >
          {download.isPending ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />} Download
        </button>
        {canEdit && !confirming && (
          <button type="button" aria-label={`Delete ${label}`} onClick={() => setConfirming(true)} className={ACTION_CLASS}>
            <Trash2 className="size-3" /> Delete
          </button>
        )}
        {canEdit && confirming && (
          <div role="group" aria-label="Confirm delete" className="flex items-center gap-1">
            <button
              type="button"
              aria-label={`Confirm delete ${label}`}
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
              className="rounded bg-destructive px-2 py-1 text-2xs font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
            >
              {remove.isPending ? <Loader2 className="size-3 animate-spin" /> : 'Delete'}
            </button>
            <button type="button" aria-label="Cancel delete" onClick={() => setConfirming(false)} className={ACTION_CLASS}>
              Cancel
            </button>
          </div>
        )}
      </div>
      <DxfDrawingBody orderId={orderId} attachment={attachment} label={label} />
    </div>
  );
}
