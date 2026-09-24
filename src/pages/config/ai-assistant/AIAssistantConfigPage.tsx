import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/api/tenantClient';
import { PageHeader, Spinner, ErrorNote } from '@/components/tenant/ui';
import { Switch } from '@/components/ui/switch';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { getAIStatus, setTenantAIEnabled } from '@/services/aiService';
import type { AIStatus } from '@/types/ai';

// Tenant-admin half of the assistant's two-switch design (see
// PlatformAIPage for the platform-admin half): both must be on for the
// assistant to be reachable, which is exactly what ['ai-status']'s
// `available` already computes server-side.
export default function AIAssistantConfigPage() {
  const qc = useQueryClient();
  const { hasPermission } = useUserPermissions();
  const canConfigure = hasPermission('company_profile', 'configure');

  const statusQ = useQuery({
    queryKey: ['ai-status'],
    queryFn: getAIStatus,
    staleTime: 60 * 1000,
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setTenantAIEnabled(enabled),
    onSuccess: (status: AIStatus) => {
      qc.setQueryData(['ai-status'], status);
      toast.success(status.tenantEnabled ? 'StoneSuite Assistant enabled for your organization.' : 'StoneSuite Assistant disabled for your organization.');
    },
  });

  const status = statusQ.data;
  const platformOff = status?.platformEnabled === false;

  return (
    <div className="p-6 3xl:p-10 4xl:p-14">
      <PageHeader
        title="StoneSuite Assistant"
        subtitle="Turn the AI assistant on or off for your organization."
      />

      <section className="max-w-2xl rounded-[10px] border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
        <div className="mb-4 flex items-start gap-3 border-b border-stone-100 pb-4 dark:border-stone-800">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand-dark">
            <Sparkles className="size-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-950 dark:text-white">What it does</h2>
            <p className="mt-1 text-xs text-stone-500">
              The assistant answers questions about your leads, prospects, and customers, and about how to use
              StoneSuite, by searching your organization&apos;s records and the help docs. Turning it off hides it
              for everyone in your organization — it does not delete any conversation history or indexed data, and
              turning it back on restores access immediately.
            </p>
          </div>
        </div>

        {statusQ.isLoading ? (
          <Spinner label="Loading assistant settings…" />
        ) : statusQ.error ? (
          <ErrorNote>{apiErrorMessage(statusQ.error, 'Failed to load the assistant setting.')}</ErrorNote>
        ) : (
          <>
            {platformOff && (
              <div className="mb-3">
                <ErrorNote>
                  The assistant is turned off for all organizations by the StoneSuite platform administrator.
                </ErrorNote>
              </div>
            )}

            <label className="flex items-center justify-between gap-3 select-none">
              <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Enable StoneSuite Assistant for your organization
              </span>
              <Switch
                checked={status?.tenantEnabled ?? false}
                onCheckedChange={(checked) => toggle.mutate(checked)}
                disabled={!canConfigure || platformOff || toggle.isPending}
                aria-label="Enable StoneSuite Assistant for your organization"
              />
            </label>

            {toggle.error && (
              <div className="mt-3">
                <ErrorNote>{apiErrorMessage(toggle.error, 'Failed to update the assistant setting.')}</ErrorNote>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
