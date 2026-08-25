import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Search, Download } from "lucide-react";
import { portalAccessService } from "@/services/portalAccessService";
import { apiErrorMessage } from "@/api/tenantClient";
import { Spinner, ErrorNote } from "@/components/tenant/ui";
import { buildCsvText, buildCsvFilename, downloadCsv, fmtCsvDate } from "@/lib/csvExport";
import { PortalUserRosterTable } from "./components/PortalUserRosterTable";
import type { PortalUserStatus } from "@/types/portalUser";

const STATUS_FILTERS: { value: PortalUserStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "revoked", label: "Revoked" },
];

const CSV_HEADERS = ["Email", "Full Name", "Customer", "Status", "Invite Status", "Granted", "Granted By"];

// Tenant-wide view of every customer-portal login, across every customer —
// the "who from outside can get into my workspace" roster. Actions (grant,
// suspend/resume, revoke) live on the customer's own Portal Access tab
// (PortalAccessPanel); this page is read-only and links out to that tab.
export default function PortalUsersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PortalUserStatus | "all">("all");

  const usersQ = useQuery({
    queryKey: ["portal-users", "tenant"],
    queryFn: portalAccessService.listForTenant,
  });
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (usersQ.data ?? []).filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (!term) return true;
      return (
        u.email.toLowerCase().includes(term) ||
        u.fullName.toLowerCase().includes(term) ||
        u.customerName.toLowerCase().includes(term)
      );
    });
  }, [usersQ.data, search, statusFilter]);

  function handleExportCsv() {
    const rows = filtered.map((u) => [
      u.email, u.fullName, u.customerName, u.status, u.inviteStatus,
      fmtCsvDate(u.createdAt), u.grantedByName,
    ]);
    downloadCsv(buildCsvFilename("portal-user"), buildCsvText(CSV_HEADERS, rows));
  }

  return (
    <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
          <KeyRound className="size-5 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">Customer Portal Users</h1>
          <p className="text-sm text-stone-500">
            Every external login into this workspace, across all customers.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-1 flex-col gap-3 min-h-0 border-t border-stone-100 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email, name, or customer…"
              aria-label="Search portal users"
              className="h-9 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 text-xs text-stone-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PortalUserStatus | "all")}
            aria-label="Filter by status"
            className="h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-xs text-stone-700 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          {filtered.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              aria-label="Download CSV"
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50"
            >
              <Download className="size-3.5" />
              Download CSV
            </button>
          )}
        </div>

        {usersQ.isLoading && <Spinner label="Loading portal users…" />}
        {usersQ.isError && (
          <ErrorNote>{apiErrorMessage(usersQ.error, "Failed to load portal users.")}</ErrorNote>
        )}
        {!usersQ.isLoading && !usersQ.isError && (
          <PortalUserRosterTable entries={filtered} />
        )}
      </div>
    </div>
  );
}
