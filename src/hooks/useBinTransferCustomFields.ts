import { useQuery } from '@tanstack/react-query';
import { workflowService } from '@/services/tenantServices';
import { activeCustomFields } from '@/lib/customFields';
import type { FieldDefinition } from '@/types/tenant';

const BIN_TRANSFER_WORKFLOW_KEY = 'bin_transfer';

/**
 * The custom fields an admin has defined for Bin Transfer under Configuration →
 * Workflows (`[]` while the workflow's Custom fields section is off). Rendered at
 * runtime through DynamicFieldInput — a transfer's extra fields are never
 * hardcoded in a page.
 */
export function useBinTransferCustomFields(): FieldDefinition[] {
  const { data: workflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const workflow = workflows.find((wf) => wf.key.toLowerCase() === BIN_TRANSFER_WORKFLOW_KEY);
  const { data: definition } = useQuery({
    queryKey: ['workflow', workflow?.id],
    queryFn: () => workflowService.get(workflow?.id ?? ''),
    enabled: Boolean(workflow?.id),
  });
  return activeCustomFields(definition);
}
