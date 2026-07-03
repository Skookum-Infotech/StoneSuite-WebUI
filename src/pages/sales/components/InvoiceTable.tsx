import { CrmRecordTable } from '@/components/crm/CrmRecordTable';

const CONFIG = {
  workflowKey: 'invoice',
  label: 'Invoice',
  detailPath: (id: string) => `/sales/invoice/${id}`,
  editPath: (id: string) => `/sales/invoice/${id}/edit`,
  queryKey: ['crm-records', 'invoice'] as const,
  showEmail: false,
} as const;

export function InvoiceTable() {
  return <CrmRecordTable config={CONFIG} />;
}
