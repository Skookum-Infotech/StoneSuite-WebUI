import { CrmRecordTable } from '@/components/crm/CrmRecordTable';

const CONFIG = {
  workflowKey: 'sales_order',
  label: 'Sales Order',
  detailPath: (id: string) => `/sales/sales_order/${id}`,
  editPath: (id: string) => `/sales/sales_order/${id}/edit`,
  queryKey: ['crm-records', 'sales_order'] as const,
  showEmail: false,
} as const;

export function SalesOrderTable() {
  return <CrmRecordTable config={CONFIG} />;
}
