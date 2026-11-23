import { tenantClient } from '@/api/tenantClient';
import type {
  ProposedAction,
  ProposedActionConfirmResult,
  ProposedActionPage,
} from '@/types/proposedAction';

interface ListOpts {
  limit?: number;
  cursor?: string;
}

const BASE = '/tenant/actions';

// Errors are surfaced as the shared axios error (`{success:false, message}` body);
// use apiErrorMessage() for display and err.response.status for 403/404/409/410/422.
export const proposedActionService = {
  // Own proposed actions, newest first. The cursor is opaque: pass back what
  // the server returned in nextCursor, never construct one.
  list: (opts: ListOpts = {}): Promise<ProposedActionPage> => {
    const params: Record<string, string> = {};
    if (opts.limit) params.limit = String(opts.limit);
    if (opts.cursor) params.cursor = opts.cursor;
    return tenantClient
      .get<{ success: boolean; actions?: ProposedAction[]; nextCursor?: string }>(BASE, { params })
      .then((r) => ({ actions: r.data.actions ?? [], nextCursor: r.data.nextCursor ?? '' }));
  },

  get: (id: string): Promise<ProposedAction> =>
    tenantClient
      .get<{ success: boolean; action: ProposedAction }>(`${BASE}/${encodeURIComponent(id)}`)
      .then((r) => r.data.action),

  // Executes the stored change. Idempotent server-side: a repeat returns
  // replayed=true with the original result.
  confirm: (id: string): Promise<ProposedActionConfirmResult> =>
    tenantClient
      .post<{ success: boolean; action: ProposedAction; replayed?: boolean; message?: string }>(
        `${BASE}/${encodeURIComponent(id)}/confirm`,
      )
      .then((r) => ({
        action: r.data.action,
        replayed: r.data.replayed ?? false,
        message: r.data.message ?? '',
      })),

  cancel: (id: string): Promise<ProposedAction> =>
    tenantClient
      .post<{ success: boolean; action: ProposedAction }>(
        `${BASE}/${encodeURIComponent(id)}/cancel`,
      )
      .then((r) => r.data.action),
};
