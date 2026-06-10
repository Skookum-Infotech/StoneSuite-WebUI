import { CrmRecordTable } from '@/components/crm/CrmRecordTable';
import type { WorkflowRecord } from '@/types/tenant';

const CONFIG = {
  workflowKey: 'prospect',
  label:       'Prospect',
  detailPath:  (id: string) => `/prospects/${id}`,
  editPath:    (id: string) => `/prospects/${id}/edit`,
  queryKey:    ['crm-records', 'prospect'] as const,
  showEmail:   true,
} as const;

type Props = { records: WorkflowRecord[]; isLoading?: boolean };

export function ProspectTable({ records, isLoading = false }: Props) {
  return <CrmRecordTable records={records} isLoading={isLoading} config={CONFIG} />;
}
