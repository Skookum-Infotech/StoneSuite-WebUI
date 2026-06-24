import { CrmRecordTable } from '@/components/crm/CrmRecordTable';

const CONFIG = {
  workflowKey: 'prospect',
  label:       'Prospect',
  detailPath:  (id: string) => `/crm/prospect/${id}`,
  editPath:    (id: string) => `/crm/prospect/${id}/edit`,
  queryKey:    ['crm-records', 'prospect'] as const,
  showEmail:   true,
} as const;

export function ProspectTable() {
  return <CrmRecordTable config={CONFIG} />;
}
