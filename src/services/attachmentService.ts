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

export type UploadErrorKind = 'aborted' | 'storage_unavailable' | 'retryable';

/** Thrown by uploadToR2 so callers can tell "cancelled", "storage said no"
 *  (4xx — don't retry) and "try again" (network / 5xx) apart. */
export class UploadError extends Error {
  kind: UploadErrorKind;
  status?: number;
  constructor(kind: UploadErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'UploadError';
    this.kind = kind;
    this.status = status;
  }
}

const HTTP_CLIENT_ERROR_MIN = 400;
const HTTP_SERVER_ERROR_MIN = 500;

/** Maps an R2 PUT status to an UploadErrorKind: 4xx is final, anything else retries. */
export function classifyUploadStatus(status: number): UploadErrorKind {
  return status >= HTTP_CLIENT_ERROR_MIN && status < HTTP_SERVER_ERROR_MIN
    ? 'storage_unavailable'
    : 'retryable';
}

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

  /** PUT a single file directly to R2 using the presigned URL. Rejects with an
   *  UploadError: `aborted` when `signal` fires, `storage_unavailable` for an R2
   *  4xx (retrying won't help), `retryable` for a network error, timeout or 5xx. */
  uploadToR2: (
    uploadUrl: string,
    file: File,
    onProgress?: (pct: number) => void,
    signal?: AbortSignal,
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new UploadError('aborted', 'Upload cancelled'));
        return;
      }
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      const onAbort = () => xhr.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      const done = () => signal?.removeEventListener('abort', onAbort);
      xhr.onload = () => {
        done();
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new UploadError(classifyUploadStatus(xhr.status), `Upload failed (${xhr.status})`, xhr.status));
      };
      xhr.onerror = () => {
        done();
        reject(new UploadError('retryable', 'Network error during upload'));
      };
      xhr.ontimeout = () => {
        done();
        reject(new UploadError('retryable', 'Upload timed out'));
      };
      xhr.onabort = () => {
        done();
        reject(new UploadError('aborted', 'Upload cancelled'));
      };
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
