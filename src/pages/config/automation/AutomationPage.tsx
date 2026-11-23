import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/tenant/ui';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AUTOMATION_RULES_QUERY_KEY, AUTOMATION_SETTINGS_QUERY_KEY } from '@/hooks/useAutomationKillSwitch';
import { isNotSending } from '@/lib/automationCopy';
import { automationRuleService } from '@/services/automationRuleService';
import { automationSettingsService } from '@/services/automationSettingsService';
import type { AutomationRule } from '@/types/automationRule';
import { AutomationStatusBanner } from './AutomationStatusBanner';
import { PauseSwitch } from './PauseSwitch';
import { PreviewDrawer } from './PreviewDrawer';
import { RulesTable } from './RulesTable';

/** Configure → Automation: every scheduled rule, the workspace pause switch and platform status. */
export default function AutomationPage() {
  const { hasPermission } = useUserPermissions();
  const canConfigure = hasPermission('automation', 'configure');
  const [previewing, setPreviewing] = useState<AutomationRule | null>(null);

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
          <PauseSwitch
            paused={settings?.killSwitch ?? false}
            canConfigure={canConfigure}
            unavailable={!settings}
          />
        }
      />
      <AutomationStatusBanner settings={settings} canConfigure={canConfigure} />
      <RulesTable
        query={rulesQ}
        canConfigure={canConfigure}
        notSending={isNotSending(settings)}
        onPreview={setPreviewing}
      />
      {previewing && <PreviewDrawer rule={previewing} onClose={() => setPreviewing(null)} />}
    </div>
  );
}
