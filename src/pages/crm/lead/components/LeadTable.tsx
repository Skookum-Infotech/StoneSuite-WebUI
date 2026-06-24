import { CrmRecordTable } from '@/components/crm/CrmRecordTable';

const CONFIG = {
  workflowKey: 'lead',
  label:       'Lead',
  detailPath:  (id: string) => `/crm/lead/${id}`,
  editPath:    (id: string) => `/crm/lead/${id}/edit`,
  queryKey:    ['crm-records', 'lead'] as const,
  showEmail:   true,
} as const;

export function LeadTable() {
  return <CrmRecordTable config={CONFIG} />;
}
