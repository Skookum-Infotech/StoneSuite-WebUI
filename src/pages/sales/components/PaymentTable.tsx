import { CrmRecordTable } from '@/components/crm/CrmRecordTable';

const CONFIG = {
  workflowKey: 'payment',
  label: 'Payment',
  detailPath: (id: string) => `/sales/payment/${id}`,
  editPath: (id: string) => `/sales/payment/${id}/edit`,
  queryKey: ['crm-records', 'payment'] as const,
  showEmail: false,
} as const;

export function PaymentTable() {
  return <CrmRecordTable config={CONFIG} />;
}
