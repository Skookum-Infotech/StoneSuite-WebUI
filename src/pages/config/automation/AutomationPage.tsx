import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/tenant/ui';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AUTOMATION_RULES_QUERY_KEY, AUTOMATION_SETTINGS_QUERY_KEY } from '@/hooks/useAutomationKillSwitch';
import { isNotSending } from '@/lib/automationCopy';
import { automationRuleService } from '@/services/automationRuleService';
import { automationSettingsService } from '@/services/automationSettingsService';
import type { AutomationRule } from '@/types/automationRule';
import { AddRuleDialog } from './AddRuleDialog';
import { AutomationStatusBanner } from './AutomationStatusBanner';
import { PauseSwitch } from './PauseSwitch';
import { PreviewDrawer } from './PreviewDrawer';
import { RulesTable } from './RulesTable';

/** Configure → Automation: every scheduled rule, the workspace pause switch and platform status. */
export default function AutomationPage() {
  const { hasPermission } = useUserPermissions();
  const canConfigure = hasPermission('automation', 'configure');
  const [previewing, setPreviewing] = useState<AutomationRule | null>(null);
  const [adding, setAdding] = useState(false);

  const rulesQ = useQuery({
    queryKey: [AUTOMATION_RULES_QUERY_KEY],
    queryFn: () => automationRuleService.list(),
  });
  const settingsQ = useQuery({
    queryKey: [AUTOMATION_SETTINGS_QUERY_KEY],
    queryFn: () => automationSettingsService.get(),
  });

  const settings = settingsQ.data;
  return (
    <div className="p-6 3xl:p-10 4xl:p-14">
      <PageHeader
        title="Automation"
        subtitle="Scheduled reminders StoneSuite sends on your behalf."
        action={
          <div className="flex flex-wrap items-center gap-3">
            {canConfigure && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                aria-label="Add rule"
                className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800"
              >
                <Plus className="size-3.5" aria-hidden="true" /> Add rule
              </button>
            )}
            <PauseSwitch
              paused={settings?.killSwitch ?? false}
              canConfigure={canConfigure}
              unavailable={!settings}
            />
          </div>
        }
      />
      <AutomationStatusBanner settings={settings} canConfigure={canConfigure} />
      <RulesTable
        query={rulesQ}
        canConfigure={canConfigure}
        notSending={isNotSending(settings)}
        onPreview={setPreviewing}
      />
      {adding && <AddRuleDialog onClose={() => setAdding(false)} />}
      {previewing && <PreviewDrawer rule={previewing} onClose={() => setPreviewing(null)} />}
    </div>
  );
}
