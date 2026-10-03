import { AxiosError } from 'axios';
import { tenantClient } from '@/api/tenantClient';
import { attachmentService } from '@/services/attachmentService';
import type {
  CompleteExtractionInput,
  CreateExtractionInput,
  CreateExtractionResult,
  DocumentExtraction,
  ExtractionErrorCode,
  ExtractionStatus,
  PresignExtractionResult,
} from '@/types/documentExtraction';

const BASE = '/tenant/document-extractions';
const HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;

/** An API failure carrying the backend's stable `code` (ai_disabled,
 *  daily_limit, storage_full, upload_missing, expired, already_used). */
export class ExtractionApiError extends Error {
  status: number;
  code?: ExtractionErrorCode;
  constructor(status: number, message: string, code?: ExtractionErrorCode) {
    super(message);
    this.name = 'ExtractionApiError';
    this.status = status;
    this.code = code;
  }
}

/** Converts an axios failure into an ExtractionApiError (anything else is rethrown as-is). */
export function toExtractionError(err: unknown): unknown {
  if (err instanceof AxiosError && err.response) {
    const data = err.response.data as { message?: string; code?: ExtractionErrorCode } | undefined;
    return new ExtractionApiError(err.response.status, data?.message ?? err.message, data?.code);
  }
  return err;
}

async function call<T>(request: Promise<{ data: T }>): Promise<T> {
  try {
    return (await request).data;
  } catch (err) {
    throw toExtractionError(err);
  }
}

/** Lowercase hex SHA-256 of a file via WebCrypto — sent on /start so the server
 *  can detect an upload corrupted in transit. */
export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, '0'))
    .join('');
}

export const documentExtractionService = {
  /** Registers an upload and returns the presigned PUT URL. */
  create: (input: CreateExtractionInput): Promise<CreateExtractionResult> =>
    call(tenantClient.post<CreateExtractionResult>(BASE, input)),

  /** Re-issues an upload URL for the same id (expired or interrupted upload). */
  presign: (id: string): Promise<PresignExtractionResult> =>
    call(tenantClient.post<PresignExtractionResult>(`${BASE}/${id}/presign`)),

  /** PUTs the file to R2; rejects with an UploadError (see attachmentService). */
  upload: (
    uploadUrl: string,
    file: File,
    onProgress?: (pct: number) => void,
    signal?: AbortSignal,
  ): Promise<void> => attachmentService.uploadToR2(uploadUrl, file, onProgress, signal),

  /** Tells the server the upload is done; 409 upload_missing when no object landed. */
  start: (id: string, clientSha256: string): Promise<{ status: ExtractionStatus }> =>
    call(tenantClient.post<{ status: ExtractionStatus }>(`${BASE}/${id}/start`, { clientSha256 })),

  /** One extraction (owner-only). 404 `expired` once the 24 h window has passed. */
  get: async (id: string): Promise<DocumentExtraction> =>
    (await call(tenantClient.get<{ success: boolean; extraction: DocumentExtraction }>(`${BASE}/${id}`))).extraction,

  /** The caller's own extractions in a given status (Pending documents chip). */
  list: async (status: ExtractionStatus = 'ready'): Promise<DocumentExtraction[]> =>
    (await call(tenantClient.get<{ extractions?: DocumentExtraction[] }>(BASE, { params: { status } })))
      .extractions ?? [],

  /** Asks for a notification when the job finishes (dialog closed mid-run). */
  notify: (id: string): Promise<void> =>
    call(tenantClient.post(`${BASE}/${id}/notify`)).then(() => undefined),

  /** Deletes the staged file and marks the extraction discarded. */
  discard: (id: string): Promise<void> =>
    call(tenantClient.post(`${BASE}/${id}/discard`)).then(() => undefined),

  /** Marks the extraction used by a saved record; 409 already_used if it was. */
  complete: (id: string, input: CompleteExtractionInput): Promise<void> =>
    call(tenantClient.post(`${BASE}/${id}/complete`, input)).then(() => undefined),
};
