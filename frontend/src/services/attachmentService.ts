import { tenantClient } from '@/api/tenantClient';

export type Attachment = {
  id: string;
  recordId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  checksumSha256: string;
  status: 'pending' | 'clean' | 'infected' | 'failed';
  uploadedByUserId: string;
  createdAt: string;
};

export type PresignResult = {
  fileName: string;
  storageKey: string;
  uploadUrl: string;
};

export const attachmentService = {
  presignBatch: (
    recordId: string,
    files: Array<{ fileName: string; contentType: string; sizeBytes: number }>,
  ): Promise<PresignResult[]> =>
    tenantClient
      .post<{ success: boolean; files: PresignResult[] }>(
        `/tenant/records/${recordId}/attachments/presign-batch`,
        { files },
      )
      .then((r) => r.data.files),

  /** PUT a single file directly to R2 using the presigned URL. */
  uploadToR2: (
    uploadUrl: string,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(file);
    }),

  confirmAttachments: (
    recordId: string,
    attachments: Array<{
      fileName: string;
      contentType: string;
      sizeBytes: number;
      storageKey: string;
      checksumSha256: string;
    }>,
  ): Promise<Attachment[]> =>
    tenantClient
      .post<{ success: boolean; attachments: Attachment[] }>(
        `/tenant/records/${recordId}/attachments`,
        { attachments },
      )
      .then((r) => r.data.attachments ?? []),

  listAttachments: (recordId: string): Promise<Attachment[]> =>
    tenantClient
      .get<{ success: boolean; attachments: Attachment[] }>(
        `/tenant/records/${recordId}/attachments`,
      )
      .then((r) => r.data.attachments ?? []),

  downloadAttachment: (
    recordId: string,
    attachmentId: string,
  ): Promise<{ downloadUrl: string; fileName: string }> =>
    tenantClient
      .get<{ success: boolean; downloadUrl: string; fileName: string }>(
        `/tenant/records/${recordId}/attachments/${attachmentId}/download`,
      )
      .then((r) => ({ downloadUrl: r.data.downloadUrl, fileName: r.data.fileName })),

  deleteAttachment: (recordId: string, attachmentId: string): Promise<void> =>
    tenantClient
      .delete(`/tenant/records/${recordId}/attachments/${attachmentId}`)
      .then(() => undefined),
};
