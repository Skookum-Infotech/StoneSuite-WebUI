import { CrmRecordTable } from '@/components/crm/CrmRecordTable';
import type { WorkflowRecord } from '@/types/tenant';

const CONFIG = {
  workflowKey: 'customer',
  label:       'Customer',
  detailPath:  (id: string) => `/crm/customer/${id}`,
  editPath:    (id: string) => `/crm/customer/${id}/edit`,
  queryKey:    ['crm-records', 'customer'] as const,
  showEmail:   true,
} as const;

type Props = { records: WorkflowRecord[]; isLoading?: boolean };

export function CustomerTable({ records, isLoading = false }: Props) {
  return <CrmRecordTable records={records} isLoading={isLoading} config={CONFIG} />;
}
