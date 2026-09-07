import { tenantClient } from '@/api/tenantClient';
import type {
  ImportColumnMapping,
  ImportJobSummary,
  ImportMappedFields,
  ImportPresignResult,
  ImportRow,
  ImportSummary,
} from '@/types/import';

export const importService = {
  presign: (
    workflowKey: string,
    file: { fileName: string; contentType: string; sizeBytes: number },
  ): Promise<ImportPresignResult> =>
    tenantClient
      .post<{ success: boolean; storageKey: string; uploadUrl: string }>('/tenant/import/presign', {
        workflowKey,
        ...file,
      })
      .then((r) => ({ storageKey: r.data.storageKey, uploadUrl: r.data.uploadUrl })),

  /** PUT the file directly to R2 using the presigned URL — same mechanics as
   *  attachmentService.uploadToR2, except contentType is passed explicitly
   *  (the canonical extension-derived type importConstants.ts uses) rather
   *  than read from file.type, so the PUT's Content-Type header always
   *  matches what presign() signed the URL for. */
  uploadToR2: (
    uploadUrl: string,
    file: File,
    contentType: string,
    onProgress?: (pct: number) => void,
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', contentType);
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

  // columnMapping may be omitted/empty — the worker then stages every row
  // with its raw column data but no fields mapped yet, for mapping during
  // review (PATCH per row via updateRow) instead of upfront.
  createJob: (
    workflowKey: string,
    storageKey: string,
    fileName: string,
    columnMapping?: ImportColumnMapping,
  ): Promise<string> =>
    tenantClient
      .post<{ success: boolean; jobId: string }>('/tenant/import/jobs', {
        workflowKey,
        storageKey,
        fileName,
        columnMapping,
      })
      .then((r) => r.data.jobId),

  listJobs: (workflowKey: string): Promise<ImportJobSummary[]> =>
    tenantClient
      .get<{ success: boolean; jobs: ImportJobSummary[] }>('/tenant/import/jobs', {
        params: { workflowKey },
      })
      .then((r) => r.data.jobs ?? []),

  getJob: (jobId: string): Promise<ImportJobSummary> =>
    tenantClient
      .get<{ success: boolean; job: ImportJobSummary }>(`/tenant/import/jobs/${jobId}`)
      .then((r) => r.data.job),

  listRows: (jobId: string): Promise<ImportRow[]> =>
    tenantClient
      .get<{ success: boolean; rows: ImportRow[] }>(`/tenant/import/jobs/${jobId}/rows`)
      .then((r) => r.data.rows ?? []),

  updateRowMapped: (jobId: string, rowId: string, mapped: ImportMappedFields): Promise<void> =>
    tenantClient
      .patch(`/tenant/import/jobs/${jobId}/rows/${rowId}`, { mapped })
      .then(() => undefined),

  skipRow: (jobId: string, rowId: string): Promise<void> =>
    tenantClient
      .patch(`/tenant/import/jobs/${jobId}/rows/${rowId}`, { skip: true })
      .then(() => undefined),

  commit: (jobId: string): Promise<ImportSummary> =>
    tenantClient
      .post<{ success: boolean; summary: ImportSummary }>(`/tenant/import/jobs/${jobId}/commit`)
      .then((r) => r.data.summary),
};
