// Real-data payloads for dashboard widgets (as opposed to
// src/types/dashboardWidgets.ts, which covers widget allocation/preference —
// which widgets a role/user may see, not what they render).

// The dashboard-wide time window, controlled by ConsoleHeader and threaded
// into every range-aware widget query. 'all' is the default: the current
// shape of the data, not a recent-activity window (see DashboardPage).
export type DashboardRange = 'all' | '7d' | '30d' | 'quarter';

export interface PipelineMixSegment {
  id: 'lead' | 'prospect' | 'customer';
  count: number;
}

export interface PipelineMix {
  range: DashboardRange;
  segments: PipelineMixSegment[];
  closeRate: number;
}
