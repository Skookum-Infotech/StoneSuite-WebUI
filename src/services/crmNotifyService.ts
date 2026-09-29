import { tenantClient } from '@/api/tenantClient';

/** The recipient groups a workspace maps to roles for CRM lifecycle emails. */
export type CrmNotifyGroup = 'manager' | 'finance';

export interface CrmNotifyRoleRef {
  roleId: string;
  roleName: string;
}

export type CrmNotifyRecipients = Record<CrmNotifyGroup, CrmNotifyRoleRef[]>;

/** Role ids per group, the shape the save endpoint takes. */
export type CrmNotifyRoleIds = Record<CrmNotifyGroup, string[]>;

interface RecipientsWire {
  success: boolean;
  manager: CrmNotifyRoleRef[] | null;
  finance: CrmNotifyRoleRef[] | null;
}

// Roles whose members count as the Manager and Finance recipients of the CRM
// lifecycle emails (Lead / Prospect / Customer status changes).
export const crmNotifyService = {
  getRecipients: (): Promise<CrmNotifyRecipients> =>
    tenantClient
      .get<RecipientsWire>('/tenant/config/crm-notify-recipients')
      .then((r) => ({ manager: r.data.manager ?? [], finance: r.data.finance ?? [] })),
  saveRecipients: (roleIds: CrmNotifyRoleIds): Promise<void> =>
    tenantClient.put('/tenant/config/crm-notify-recipients', roleIds).then(() => undefined),
};
