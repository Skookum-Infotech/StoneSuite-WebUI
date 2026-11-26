/**
 * The health snapshot the stonesuite-watchdog Cloudflare Worker saves every
 * hour (StoneSuite-Backend/watchdog/checks.js buildSnapshot), served as-is by
 * GET /api/platform/system-health.
 */

export type UsageLevel = 'unknown' | 'ok' | 'warning' | 'critical' | 'exceeded';
export type ProblemSeverity = 'warning' | 'critical';

export interface UsagePart {
  used: number | null;
  limit: number;
  percent: number | null;
}

export interface DatabaseHealth {
  id: string;
  name: string;
  plan: string | null;
  compute: UsagePart;
  storage: UsagePart;
  transfer: UsagePart;
  periodEnd: string | null;
  lastActiveAt: string | null;
  level: UsageLevel;
}

export interface MachineExit {
  code: number | null;
  oomKilled: boolean;
  requestedStop: boolean;
  restarts: number | null;
  at: string | null;
}

export interface MachineHealth {
  id: string;
  state: string;
  region: string | null;
  lastExit: MachineExit | null;
  crashing: boolean;
}

export interface AppHealth {
  app: string;
  machines: MachineHealth[];
  crashing: boolean;
  awakeHours24h: number | null;
  wakes24h: number | null;
  errors5xx24h: number | null;
}

export interface SiteHealth {
  url: string;
  ok: boolean;
  status: number | null;
  ms: number;
  error?: string;
}

export interface HealthProblem {
  key: string;
  severity: ProblemSeverity;
  title: string;
  detail: string;
}

export interface SourceError {
  source: string;
  message: string;
}

export interface HealthSnapshot {
  version: number;
  checkedAt: string;
  sites: SiteHealth[];
  apps: AppHealth[];
  databases: DatabaseHealth[];
  sourceErrors: SourceError[];
  problems: HealthProblem[];
}

export interface SystemHealthResponse {
  configured: boolean;
  snapshot: HealthSnapshot | null;
  message?: string;
}
