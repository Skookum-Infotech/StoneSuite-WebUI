import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/api/tenantClient';
import { attachmentService, type Attachment } from '@/services/attachmentService';
import { isDxfFileName, MAX_DXF_UPLOAD_BYTES, withDxfContentType } from '@/lib/drawing/dxfFiles';

const BYTES_PER_MB = 1024 * 1024;

function rejectionReason(file: File): string | null {
  if (!isDxfFileName(file.name)) return `${file.name} isn't a .dxf file.`;
  if (file.size > MAX_DXF_UPLOAD_BYTES) return `${file.name} is over the ${MAX_DXF_UPLOAD_BYTES / BYTES_PER_MB} MB limit.`;
  return null;
}

/** Uploads DXFs through the order's attachments. `onUploaded` gets the last file that landed. */
export function useDxfUpload(orderId: string, onUploaded: (attachment: Attachment) => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (files: File[]) => attachmentService.uploadFiles(orderId, files),
    onSuccess: ({ uploaded, failed }) => {
      if (uploaded.length > 0) {
        toast.success(uploaded.length === 1 ? `${uploaded[0].fileName} uploaded` : `${uploaded.length} files uploaded`);
        onUploaded(uploaded[uploaded.length - 1]);
      }
      if (failed.length > 0) toast.error(`Couldn't upload ${failed.join(', ')}. Please try again.`);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Upload failed. Please try again.')),
    // Runs on failure too: an earlier batch may already have landed.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['record-attachments', orderId] }),
  });

  const upload = (files: File[]) => {
    const accepted = files.filter((file) => {
      const reason = rejectionReason(file);
      if (reason) toast.error(reason);
      return !reason;
    });
    if (accepted.length > 0) mutation.mutate(accepted.map(withDxfContentType));
  };

  return { upload, isUploading: mutation.isPending };
}
