import { tenantClient } from '@/api/tenantClient';
import type { SystemHealthResponse } from '@/types/systemHealth';

type Envelope = { success: boolean } & SystemHealthResponse;

/** Platform-admin: the latest hourly health snapshot from the watchdog Worker.
 *  Reads Cloudflare KV on the backend, never Neon or Fly directly. */
export function getSystemHealth(): Promise<SystemHealthResponse> {
  return tenantClient.get<Envelope>('/platform/system-health').then((r) => r.data);
}
