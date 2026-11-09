import { useRef, useState, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SavedCustomReport } from "@/types/customReports";
import { ReportDataTable, type ReportColumn } from "../../components/ReportDataTable";

interface CustomReportListProps {
  reports: SavedCustomReport[];
  /** Source key → label, for the Source column. */
  sourceLabels: Record<string, string>;
  canCreate: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
}

type Tab = "mine" | "shared";

const PANEL_ID = "custom-reports-panel";

const TABS: { value: Tab; label: string }[] = [
  { value: "mine", label: "My reports" },
  { value: "shared", label: "Shared with workspace" },
];

const EMPTY_TEXT = "No reports yet. Describe one above or start a new report.";
const EMPTY_SHARED_TEXT = "Nobody has shared a report with the workspace yet.";

function updated(report: SavedCustomReport): string {
  return new Date(report.updatedAt).toLocaleDateString();
}

/** My reports / Shared with workspace, each a table whose names open the builder. */
export function CustomReportList({ reports, sourceLabels, canCreate, onOpen, onNew }: CustomReportListProps) {
  const [tab, setTab] = useState<Tab>("mine");
  const source = (r: SavedCustomReport) => sourceLabels[r.definition.source] ?? r.definition.source;
  const open = (name: string) => `Open report ${name}`;

  const mine = reports.filter((r) => r.isMine);
  const shared = reports.filter((r) => !r.isMine);
  const columns: ReportColumn<SavedCustomReport>[] =
    tab === "mine"
      ? [
          { key: "name", label: "Name", render: (r) => r.name, actionLabel: open },
          { key: "source", label: "Source", render: source },
          { key: "shared", label: "Shared", render: (r) => (r.shared ? "Yes" : "No") },
          { key: "updated", label: "Updated", render: updated },
        ]
      : [
          { key: "name", label: "Name", render: (r) => r.name, actionLabel: open },
          { key: "source", label: "Source", render: source },
          { key: "owner", label: "Owner", render: (r) => r.ownerName },
          { key: "updated", label: "Updated", render: updated },
        ];
  const label = TABS.find((t) => t.value === tab)?.label ?? "";
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ mine: null, shared: null });

  /** Arrow, Home and End move between the tabs, as a tablist promises. */
  function handleTabKey(event: KeyboardEvent<HTMLDivElement>) {
    const at = TABS.findIndex((t) => t.value === tab);
    const next =
      event.key === "ArrowRight" ? (at + 1) % TABS.length
      : event.key === "ArrowLeft" ? (at - 1 + TABS.length) % TABS.length
      : event.key === "Home" ? 0
      : event.key === "End" ? TABS.length - 1
      : -1;
    if (next < 0) return;
    event.preventDefault();
    setTab(TABS[next].value);
    tabRefs.current[TABS[next].value]?.focus();
  }

  return (
    <section aria-label="Saved reports" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Report lists" onKeyDown={handleTabKey} className="flex gap-1 rounded-lg bg-stone-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              ref={(el) => {
                tabRefs.current[t.value] = el;
              }}
              id={`custom-reports-tab-${t.value}`}
              type="button"
              role="tab"
              tabIndex={tab === t.value ? 0 : -1}
              aria-selected={tab === t.value}
              aria-controls={PANEL_ID}
              aria-label={t.label}
              onClick={() => setTab(t.value)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400",
                tab === t.value ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {canCreate && (
          <button
            type="button"
            aria-label="New report"
            onClick={onNew}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-stone-900 px-3 text-xs font-medium text-white transition-colors hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            New report
          </button>
        )}
      </div>
      <div role="tabpanel" id={PANEL_ID} aria-labelledby={`custom-reports-tab-${tab}`} tabIndex={0}>
        <ReportDataTable
          copy={{ caption: label, empty: tab === "mine" ? EMPTY_TEXT : EMPTY_SHARED_TEXT }}
          columns={columns}
          rows={tab === "mine" ? mine : shared}
          getRowKey={(r) => r.id}
          onRowClick={(r) => onOpen(r.id)}
        />
      </div>
    </section>
  );
}
