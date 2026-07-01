import { CrmRecordTable } from '@/components/crm/CrmRecordTable';

const CONFIG = {
  workflowKey: 'customer',
  label:       'Customer',
  detailPath:  (id: string) => `/crm/customer/${id}`,
  editPath:    (id: string) => `/crm/customer/${id}/edit`,
  queryKey:    ['crm-records', 'customer'] as const,
  showEmail:   true,
} as const;

export function CustomerTable() {
  return <CrmRecordTable config={CONFIG} />;
}
