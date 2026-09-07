// Mirrors importer.MappedFields (stonesuite-backend/importer/importer.go) —
// core (built-in) vs custom (workflow-defined) fields, kept separate because
// they commit through crmstore.CreateInput's two separate maps.
export interface ImportMappedFields {
  core: Record<string, unknown>;
  custom: Record<string, unknown>;
}

export interface ImportPresignResult {
  storageKey: string;
  uploadUrl: string;
}

export type ImportJobStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface ImportJobProgress {
  step?: string;
  staged?: number;
  total?: number;
}

export interface ImportJobSummary {
  id: string;
  workflowKey: string;
  fileName: string;
  status: ImportJobStatus;
  progress?: ImportJobProgress;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export type ImportRowStatus = 'pending' | 'committed' | 'failed' | 'skipped';

export interface ImportRow {
  id: string;
  jobId: string;
  rowIndex: number;
  raw: Record<string, string>;
  mapped: ImportMappedFields;
  errors: string[];
  status: ImportRowStatus;
  recordId: string;
}

export interface ImportSummary {
  committed: number;
  failed: number;
  skipped: number;
}

// A single column's mapping target: "core:<key>" | "cf:<key>" | "" (ignore) —
// same convention as importer.MappedFields's ApplyColumnMapping.
export type ImportColumnMapping = Record<string, string>;
