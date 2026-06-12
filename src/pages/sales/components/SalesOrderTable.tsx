import { CrmRecordTable } from '@/components/crm/CrmRecordTable';
import type { WorkflowRecord } from '@/types/tenant';

const CONFIG = {
  workflowKey: 'sales_order',
  label: 'Sales Order',
  detailPath: (id: string) => `/sales/sales_order/${id}`,
  editPath: (id: string) => `/sales/sales_order/${id}/edit`,
  queryKey: ['crm-records', 'sales_order'] as const,
  showEmail: false,
} as const;

type Props = { records: WorkflowRecord[]; isLoading?: boolean };

export function SalesOrderTable({ records, isLoading = false }: Props) {
  return <CrmRecordTable records={records} isLoading={isLoading} config={CONFIG} />;
}
