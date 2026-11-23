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

export type UploadFilesResult = { uploaded: Attachment[]; failed: string[] };

/** Matches maxFilesPerBatch in the backend's controllers/attachments.go. */
const MAX_FILES_PER_BATCH = 10;
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

  /** Presign → PUT → confirm, in batches the backend accepts. A file whose PUT
   *  fails is named in `failed` and the rest still land; a refused presign or
   *  confirm rejects, since it carries the server's reason. */
  uploadFiles: async (recordId: string, files: File[]): Promise<UploadFilesResult> => {
    const result: UploadFilesResult = { uploaded: [], failed: [] };
    for (let start = 0; start < files.length; start += MAX_FILES_PER_BATCH) {
      const batch = files.slice(start, start + MAX_FILES_PER_BATCH);
      const presigned = await attachmentService.presignBatch(
        recordId,
        batch.map((f) => ({ fileName: f.name, contentType: f.type, sizeBytes: f.size })),
      );
      const outcomes = await Promise.allSettled(
        presigned.map((p, i) => attachmentService.uploadToR2(p.uploadUrl, batch[i])),
      );
      const landed = presigned.flatMap((p, i) => {
        if (outcomes[i].status === 'rejected') {
          result.failed.push(batch[i].name);
          return [];
        }
        return [{
          fileName: p.fileName,
          contentType: batch[i].type,
          sizeBytes: batch[i].size,
          storageKey: p.storageKey,
          checksumSha256: '',
        }];
      });
      if (landed.length > 0) {
        result.uploaded.push(...await attachmentService.confirmAttachments(recordId, landed));
      }
    }
    return result;
  },

  /** The file's contents, for a viewer in the page. The link is presigned, so
   *  no credentials go with it, and it's fetched fresh because it expires fast. */
  fetchAttachmentBytes: async (recordId: string, attachmentId: string, signal?: AbortSignal): Promise<ArrayBuffer> => {
    const { downloadUrl } = await attachmentService.downloadAttachment(recordId, attachmentId);
    const response = await fetch(downloadUrl, { credentials: 'omit', signal });
    if (!response.ok) throw new Error(`Could not fetch the file (${response.status})`);
    return response.arrayBuffer();
  },
};
