import { CrmRecordTable } from '@/components/crm/CrmRecordTable';
import type { WorkflowRecord } from '@/types/tenant';

const CONFIG = {
  workflowKey: 'lead',
  label:       'Lead',
  detailPath:  (id: string) => `/crm/lead/${id}`,
  editPath:    (id: string) => `/crm/lead/${id}/edit`,
  queryKey:    ['crm-records', 'lead'] as const,
  showEmail:   true,
} as const;

type Props = { records: WorkflowRecord[]; isLoading?: boolean };

export function LeadTable({ records, isLoading = false }: Props) {
  return <CrmRecordTable records={records} isLoading={isLoading} config={CONFIG} />;
}
