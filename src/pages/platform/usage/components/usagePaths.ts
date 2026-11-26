export const USAGE_LIST_PATH = '/platform/tenant-usage';

export function usageDetailPath(tenantId: string): string {
  return `${USAGE_LIST_PATH}/${encodeURIComponent(tenantId)}`;
}
