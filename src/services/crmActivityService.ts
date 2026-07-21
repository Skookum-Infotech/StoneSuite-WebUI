import { tenantClient } from '@/api/tenantClient';

export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'task';

export type Activity = {
  id: string;
  recordId: string;
  activityType: ActivityType;
  occurredAt: string;
  author: { id?: string; name?: string };
  subject?: string;
  body?: string;
  createdAt: string;
  updatedAt: string;
};

export type ActivityInput = {
  activityType: ActivityType;
  occurredAt?: string;
  subject?: string;
  body?: string;
};

export const crmActivityService = {
  // List is already sorted newest-first server-side and is a bounded child
  // collection under one CRM record — no pagination. The filter query param
  // is `type` (verified against controllers/crm_activity.go), not
  // `activityType`.
  list: (workflowKey: string, recordId: string, activityType?: ActivityType): Promise<Activity[]> =>
    tenantClient
      .get<{ success: boolean; activities: Activity[] }>(
        `/tenant/crm/${workflowKey}/records/${recordId}/activities`,
        { params: activityType ? { type: activityType } : undefined },
      )
      .then((r) => r.data.activities ?? []),

  create: (workflowKey: string, recordId: string, input: ActivityInput): Promise<Activity> =>
    tenantClient
      .post<{ success: boolean; activity: Activity }>(
        `/tenant/crm/${workflowKey}/records/${recordId}/activities`,
        input,
      )
      .then((r) => r.data.activity),

  update: (workflowKey: string, recordId: string, activityId: string, input: ActivityInput): Promise<Activity> =>
    tenantClient
      .patch<{ success: boolean; activity: Activity }>(
        `/tenant/crm/${workflowKey}/records/${recordId}/activities/${activityId}`,
        input,
      )
      .then((r) => r.data.activity),

  remove: (workflowKey: string, recordId: string, activityId: string): Promise<void> =>
    tenantClient
      .delete(`/tenant/crm/${workflowKey}/records/${recordId}/activities/${activityId}`)
      .then(() => undefined),
};
