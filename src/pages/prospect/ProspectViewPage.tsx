import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Pencil, Clock, ArrowLeft } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { DeleteRecordDialog } from '@/components/crm/DeleteRecordDialog';
import { ConvertRecordButton } from '@/components/crm/ConvertRecordButton';
import { PRIMARY_SECTIONS, TABS } from '@/lib/prospectForm';
import { ModernSection, LeadTabBar } from '@/pages/crm/AddLeadPage';
import { cn } from '@/lib/utils';
import type { ProspectField, ProspectSection } from '@/lib/prospectForm';
import type { LeadTab } from '@/lib/leadForm';
import type { StatusInfo } from '@/types/tenant';

type HistoryEntry = {
  id: string;
  type: 'created' | 'transition' | 'edit';
  actor: string;
  initials: string;
  color: string;
  at: string;
  fromState?: string;
  toState?: string;
  summary?: string;
};

const MOCK_HISTORY: HistoryEntry[] = [
  {
    id: '3',
    type: 'transition',
    actor: 'Alex Johnson',
    initials: 'AJ',
    color: 'bg-blue-100 text-blue-700',
    at: '2 hours ago',
    fromState: 'In Discussion',
    toState: 'Qualified',
  },
  {
    id: '2',
    type: 'edit',
    actor: 'Maria Garcia',
    initials: 'MG',
    color: 'bg-emerald-100 text-emerald-700',
    at: 'Yesterday',
    summary: 'Updated company name and email',
  },
  {
    id: '1',
    type: 'created',
    actor: 'Sarah Chen',
    initials: 'SC',
    color: 'bg-purple-100 text-purple-700',
    at: '2 days ago',
  },
];

function ActivityFeed() {
  return (
    <div className="p-4 flex-1">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-3 w-3 text-stone-400" />
        <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400">Activity</p>
      </div>
      <div>
        {MOCK_HISTORY.map((entry, i) => (
          <div key={entry.id} className="relative flex gap-2.5 pb-4 last:pb-0">
            {i < MOCK_HISTORY.length - 1 && (
              <div className="absolute left-3.5 top-7 bottom-0 w-px bg-stone-100" />
            )}
            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-2xs font-semibold z-10', entry.color)}>
              {entry.initials}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              {entry.type === 'transition' && (
                <>
                  <p className="text-2xs text-stone-500 leading-relaxed">
                    <span className="font-medium text-stone-700">{entry.actor}</span>{' '}
                    moved to <span className="font-medium text-stone-700">{entry.toState}</span>
                  </p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="text-2xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-md">{entry.fromState}</span>
                    <span className="text-2xs text-stone-300">→</span>
                    <span className="text-2xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-medium">{entry.toState}</span>
                  </div>
                </>
              )}
              {entry.type === 'edit' && (
                <p className="text-2xs text-stone-500 leading-relaxed">
                  <span className="font-medium text-stone-700">{entry.actor}</span>{' '}
                  {entry.summary}
                </p>
              )}
              {entry.type === 'created' && (
                <p className="text-2xs text-stone-500 leading-relaxed">
                  <span className="font-medium text-stone-700">{entry.actor}</span>{' '}
                  created this prospect
                </p>
              )}
              <p className="text-2xs text-stone-300 mt-0.5">{entry.at}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProspectViewPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(TABS[0]?.key ?? '');

  const { data: record, isLoading, error } = useQuery({
    queryKey: ['crm-record', id],
    queryFn: () => crmService.getRecord(id, 'prospect'),
    enabled: Boolean(id),
  });

  const { data: statusData } = useQuery({
    queryKey: ['crm-statuses-workflow', 'prospect'],
    queryFn: () => crmService.getWorkflowStatuses('prospect'),
  });

  const statusMap = new Map<string, StatusInfo>(
    (statusData?.statuses ?? []).map((s) => [s.stateId, s]),
  );

  if (isLoading) return <div className="p-6"><Spinner label="Loading prospect…" /></div>;
  if (error || !record)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load prospect.')}</ErrorNote></div>;

  const statusInfo = statusMap.get(record.currentStateId);
  const cf = record.coreFields;
  const company = String(cf.company_name ?? '(unnamed prospect)');
  const activeTabObj = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  return (
    <div className="flex flex-1 min-h-0 bg-stone-50">
      {/* ── Left: scrollable content ── */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0">
        <div className="shrink-0 bg-white border-b border-stone-100 px-6 py-3.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/prospects')}
            className="text-2xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-semibold text-stone-800 leading-tight truncate">{company}</h1>
              {record.recordNumber && (
                <span className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 font-mono text-2xs text-stone-400">
                  {record.recordNumber}
                </span>
              )}
              {statusInfo && (
                <Badge color={statusInfo.color}>{statusInfo.statusLabel}</Badge>
              )}
            </div>
            <p className="text-2xs text-stone-400 mt-0.5">
              Created {new Date(record.createdAt).toLocaleDateString()} ·
              Updated {new Date(record.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden modal-scrollbar px-6 py-5 space-y-4">
          {PRIMARY_SECTIONS.map((section) => (
            <ReadOnlySectionFields key={section.title} section={section} data={cf} />
          ))}

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
            <LeadTabBar
              tabs={TABS as unknown as LeadTab[]}
              active={activeTabObj.key}
              onSelect={setActiveTab}
            />
            <div className="px-5 py-4">
              {activeTabObj.sections.length > 0 ? (
                <div className="space-y-4">
                  {activeTabObj.sections.map((section) => (
                    <ReadOnlySectionFields key={section.title} section={section} data={cf} />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 py-6">
                  <div className="h-1.5 w-1.5 rounded-full bg-stone-300" />
                  <p className="text-xs text-stone-400">
                    {activeTabObj.label} information is not available for this record
                  </p>
                </div>
              )}
            </div>
          </div>

          {Object.keys(record.customFields).length > 0 && (
            <ModernSection title="Custom Fields">
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(record.customFields).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-0.5">
                    <span className="text-2xs font-medium uppercase tracking-wide text-stone-400 leading-none">
                      {key}
                    </span>
                    <span className="text-sm font-medium text-stone-800 leading-snug break-words">
                      {String(value ?? '') || <span className="text-stone-300 font-normal text-xs">—</span>}
                    </span>
                  </div>
                ))}
              </div>
            </ModernSection>
          )}

          <div className="h-4" />
        </div>
      </div>

      {/* ── Right: actions + history panel ── */}
      <div className="w-60 xl:w-64 shrink-0 border-l border-stone-200 bg-white flex flex-col overflow-y-auto modal-scrollbar">
        <div className="p-4 border-b border-stone-100 space-y-2">
          <button
            type="button"
            onClick={() => navigate(`/prospects/${id}/edit`)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-stone-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-stone-700 transition-all duration-150 shadow-sm"
          >
            <Pencil className="size-3.5" />
            Edit Prospect
          </button>
        </div>

        {/* Record actions */}
        <div className="p-4 border-b border-stone-100">
          <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5">Record Actions</p>
          <div className="space-y-1.5">
            <div className="[&>button]:w-full [&>button]:justify-start [&>button]:rounded-lg [&>button]:text-xs">
              <ConvertRecordButton
                recordId={id}
                sourceWorkflowKey="prospect"
                onConverted={(newId) => navigate(`/crm/customer/${newId}/edit`)}
              />
            </div>
            <div className="[&>button]:w-full [&>button]:justify-start [&>button]:rounded-lg [&>button]:text-xs">
              <DeleteRecordDialog
                recordId={id}
                workflowKey="prospect"
                label={`Prospect — ${company}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['crm-records', 'prospect'] });
                  navigate('/prospects');
                }}
              />
            </div>
          </div>
        </div>

        {/* Status info */}
        {statusInfo && (
          <div className="px-4 py-3 border-b border-stone-100">
            <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400 mb-2">Current Status</p>
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: statusInfo.color || '#a8a29e' }}
              />
              <span className="text-xs font-medium text-stone-700">{statusInfo.statusLabel}</span>
            </div>
          </div>
        )}

        <ActivityFeed />
      </div>
    </div>
  );
}

function ReadOnlySectionFields({
  section,
  data,
}: {
  section: ProspectSection;
  data: Record<string, unknown>;
}) {
  const visible = section.fields.filter((f) => {
    if (f.type !== 'checkbox') {
      const v = data[f.key];
      if (v === null || v === undefined || v === '') return false;
    }
    return true;
  });
  if (visible.length === 0) return null;
  return (
    <ModernSection title={section.title}>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((f) => (
          <ReadOnlyField key={f.key} field={f} value={data[f.key]} />
        ))}
      </div>
    </ModernSection>
  );
}

function ReadOnlyField({ field, value }: { field: ProspectField; value: unknown }) {
  if (field.type === 'checkbox') {
    const checked = value === true;
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-2xs font-medium uppercase tracking-wide text-stone-400 leading-none">
          {field.label}
        </span>
        <span
          className={cn(
            'inline-flex w-fit items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
            checked ? 'bg-brand/20 text-brand-dark' : 'bg-stone-100 text-stone-400',
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', checked ? 'bg-brand-dark' : 'bg-stone-300')} />
          {checked ? 'Yes' : 'No'}
        </span>
      </div>
    );
  }

  const displayValue = String(value ?? '');
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs font-medium uppercase tracking-wide text-stone-400 leading-none">
        {field.label}
      </span>
      <span className="text-sm font-medium text-stone-800 leading-snug break-words">
        {displayValue || <span className="text-stone-300 font-normal text-xs">—</span>}
      </span>
    </div>
  );
}
