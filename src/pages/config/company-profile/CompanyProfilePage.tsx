import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CompanyProfileTab } from './components/CompanyProfileTab';
import { LocationsTab } from './components/LocationsTab';

const TABS = [
  { key: 'profile', label: 'Company Profile' },
  { key: 'locations', label: 'Locations' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function CompanyProfilePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  // The active tab's primary action (Edit/Save on Profile, Add Location on
  // Locations) portals its own button(s) into this slot in the page header,
  // while keeping all of that tab's actual state (edit mode, form,
  // mutations) local to its own component. Switching tabs unmounts the
  // previous tab, which tears down its portal automatically, so the slot
  // always reflects only the active tab.
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-stone-50/60">
      {/* Page header — icon+title on the left, the active tab's own action
          button(s) portaled in on the right (same flex row + justify-between
          split as e.g. VendorBillListPage's header). */}
      <div className="bg-background border-b border-stone-200 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/15 text-brand-dark">
              <Building2 className="size-6" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">Company Info</h1>
              <p className="text-sm text-stone-500 mt-0.5">
                Your company&apos;s own name and address — not a customer&apos;s or vendor&apos;s.
              </p>
            </div>
          </div>
          <div ref={setActionsSlot} className="flex items-center gap-2 shrink-0" />
        </div>
      </div>

      <div role="tablist" aria-label="Company Info" className="flex items-center shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-4 sm:px-5 modal-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`company-info-tab-${tab.key}`}
            aria-selected={activeTab === tab.key}
            aria-controls={`company-info-tabpanel-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors duration-150 whitespace-nowrap shrink-0',
              activeTab === tab.key
                ? 'border-brand text-stone-950'
                : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body — same centered, responsively-capped wrapper as the other
          Config settings pages (SAML Setup, Roles): mx-auto keeps whitespace
          balanced on both sides instead of pinning content to the left edge. */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1500px] 3xl:max-w-[1800px] 4xl:max-w-full px-6 py-6">
          {activeTab === 'profile' && (
            <div id="company-info-tabpanel-profile" role="tabpanel" aria-labelledby="company-info-tab-profile">
              <CompanyProfileTab actionsSlot={actionsSlot} />
            </div>
          )}
          {activeTab === 'locations' && (
            <div id="company-info-tabpanel-locations" role="tabpanel" aria-labelledby="company-info-tab-locations">
              <LocationsTab actionsSlot={actionsSlot} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
