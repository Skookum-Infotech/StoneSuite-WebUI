import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/api/tenantClient';
import { PageHeader, Spinner, ErrorNote, EmptyState } from '@/components/tenant/ui';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { rbacService } from '@/services/tenantServices';
import {
  crmNotifyService,
  type CrmNotifyGroup,
  type CrmNotifyRoleIds,
} from '@/services/crmNotifyService';

const RECIPIENTS_KEY = ['crm-notify-recipients'];

const GROUPS: { key: CrmNotifyGroup; title: string; description: string }[] = [
  {
    key: 'manager',
    title: 'Managers',
    description:
      'Emailed when a lead is Unqualified, when a prospect is created or reaches Proposal Sent, In Negotiation, Decision Pending or Lost, and when a customer is created, becomes Active, goes on Credit Hold or becomes Inactive.',
  },
  {
    key: 'finance',
    title: 'Finance',
    description: 'Emailed when a customer becomes Active, goes on Credit Hold or becomes Inactive.',
  },
];

// Choose which roles count as "Manager" and "Finance" for the CRM lifecycle
// emails. Everyone holding a chosen role is emailed; a group with no role
// chosen is simply not emailed. Owners, approvers and submitters need no
// setup — they come from the record itself.
export default function CrmNotificationsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useUserPermissions();
  const canConfigure = hasPermission('workflow_config', 'configure');

  const recipientsQ = useQuery({ queryKey: RECIPIENTS_KEY, queryFn: crmNotifyService.getRecipients });
  const rolesQ = useQuery({ queryKey: ['roles'], queryFn: rbacService.listRoles });

  // null until the user edits: the saved mapping is shown until then.
  const [draft, setDraft] = useState<CrmNotifyRoleIds | null>(null);

  const saved: CrmNotifyRoleIds | null = recipientsQ.data
    ? {
        manager: recipientsQ.data.manager.map((r) => r.roleId),
        finance: recipientsQ.data.finance.map((r) => r.roleId),
      }
    : null;
  const selection = draft ?? saved;

  const save = useMutation({
    mutationFn: (ids: CrmNotifyRoleIds) => crmNotifyService.saveRecipients(ids),
    onSuccess: () => {
      setDraft(null);
      void qc.invalidateQueries({ queryKey: RECIPIENTS_KEY });
      toast.success('Notification recipients saved.');
    },
  });

  function toggle(group: CrmNotifyGroup, roleId: string, checked: boolean) {
    if (!selection) return;
    const current = selection[group];
    const next = checked ? [...current, roleId] : current.filter((id) => id !== roleId);
    setDraft({ ...selection, [group]: next });
  }

  const loading = recipientsQ.isLoading || rolesQ.isLoading;
  const loadError = recipientsQ.error ?? rolesQ.error;
  const roles = rolesQ.data ?? [];

  return (
    <div className="p-6 3xl:p-10 4xl:p-14">
      <PageHeader
        title="CRM Email Recipients"
        subtitle="Choose who receives the manager and finance emails as leads, prospects and customers move through their statuses."
      />

      <div className="max-w-2xl space-y-4">
        {loading ? (
          <Spinner label="Loading notification settings…" />
        ) : loadError ? (
          <ErrorNote>{apiErrorMessage(loadError, 'Failed to load notification settings.')}</ErrorNote>
        ) : (
          <>
            {!canConfigure && (
              <ErrorNote role="status">
                You don&apos;t have permission to change this — it requires Workflow Config Configure access.
              </ErrorNote>
            )}

            {GROUPS.map((g) => (
              <section
                key={g.key}
                className="rounded-[10px] border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900"
              >
                <h2 className="text-sm font-semibold text-stone-950 dark:text-white">{g.title}</h2>
                <p className="mt-1 mb-3 text-xs text-stone-500">{g.description}</p>
                {roles.length === 0 ? (
                  <EmptyState>No roles exist yet.</EmptyState>
                ) : (
                  <ul className="space-y-2">
                    {roles.map((role) => {
                      const id = `crm-notify-${g.key}-${role.id}`;
                      return (
                        <li key={role.id} className="flex items-center gap-2">
                          <Checkbox
                            id={id}
                            checked={selection?.[g.key].includes(role.id) ?? false}
                            onCheckedChange={(c) => toggle(g.key, role.id, c === true)}
                            disabled={!canConfigure || save.isPending}
                          />
                          <label htmlFor={id} className="text-sm text-stone-900 dark:text-stone-100">
                            {role.name}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ))}

            {save.error && (
              <ErrorNote>{apiErrorMessage(save.error, 'Failed to save notification recipients.')}</ErrorNote>
            )}

            <Button onClick={() => draft && save.mutate(draft)} disabled={!canConfigure || !draft || save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
