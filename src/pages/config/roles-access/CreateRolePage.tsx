import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck, ChevronDown, Save } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { rbacService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner, ErrorNote } from "@/components/tenant/ui";
import { sidebarNav } from "@/config/sidebarNav";
import { cn } from "@/lib/utils";
import { SCOPES, SCOPE_LABELS, normalizeScope } from "@/lib/scope";
import type { Grant, Scope } from "@/types/tenant";

// ---------------------------------------------------------------------------

const ACTION_ORDER = [
  "read",
  "create",
  "update",
  "delete",
  "transition",
  "approve",
  "configure",
];

const ACTION_LABELS: Record<string, string> = {
  read: "Read",
  create: "Create",
  update: "Edit",
  delete: "Delete",
  transition: "Transition",
  approve: "Approve",
  configure: "Configure",
};

const DRAFT_KEY = "stonesuite:role-draft";

interface ResourceRow {
  id: string;
  resource: string;
  label: string;
}
interface PermModule {
  id: string;
  label: string;
  icon: LucideIcon;
  rows: ResourceRow[];
}

function buildPermModules(): PermModule[] {
  const out: PermModule[] = [];
  for (const section of sidebarNav.sections) {
    if (section.platformAdminOnly) continue;
    for (const entry of section.entries) {
      if (entry.type === "link") {
        if (!entry.permission || entry.platformAdminOnly) continue;
        out.push({
          id: entry.id,
          label: entry.label,
          icon: entry.icon,
          rows: [
            {
              id: entry.id,
              resource: entry.permission.resource,
              label: entry.label,
            },
          ],
        });
        continue;
      }
      const rows: ResourceRow[] = [];
      for (const child of entry.children) {
        if (!child.permission || child.platformAdminOnly) continue;
        rows.push({
          id: child.id,
          resource: child.permission.resource,
          label: child.label,
        });
      }
      if (rows.length)
        out.push({ id: entry.id, label: entry.label, icon: entry.icon, rows });
    }
  }
  return out;
}

function slugify(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

type RowSel = { actions: string[]; scope: Scope };

// ---------------------------------------------------------------------------

export default function CreateRolePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const catalogQ = useQuery({
    queryKey: ["catalog"],
    queryFn: rbacService.catalog,
    staleTime: 15 * 60 * 1000,
  });

  const [name, setName] = useState<string>(() => {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null")?.name ?? "";
    } catch {
      return "";
    }
  });
  const [key, setKey] = useState<string>(() => {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null")?.key ?? "";
    } catch {
      return "";
    }
  });
  const [keyTouched, setKeyTouched] = useState<boolean>(() => {
    try {
      return Boolean(
        JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null")?.key,
      );
    } catch {
      return false;
    }
  });
  const [description, setDescription] = useState<string>(() => {
    try {
      return (
        JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null")?.description ?? ""
      );
    } catch {
      return "";
    }
  });
  const [selected, setSelected] = useState<Record<string, RowSel>>(() => {
    try {
      const draft: Record<string, RowSel> =
        JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null")?.selected ?? {};
      // A draft saved before the `team` scope was retired would select an
      // option that no longer exists — coerce it the same way the server does.
      return Object.fromEntries(
        Object.entries(draft).map(([rowId, sel]) => [
          rowId,
          { ...sel, scope: normalizeScope(sel.scope) },
        ]),
      );
    } catch {
      return {};
    }
  });
  const [draftSaved, setDraftSaved] = useState(false);

  const modules = useMemo(() => buildPermModules(), []);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(modules.map((m) => [m.id, true])),
  );

  const actionsByResource = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const p of catalogQ.data?.permissions ?? [])
      (map[p.resource] ??= []).push(p.action);
    return map;
  }, [catalogQ.data]);

  const rowResourceById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const mod of modules) {
      for (const row of mod.rows) {
        map[row.id] = row.resource;
      }
    }
    return map;
  }, [modules]);

  const effectiveSelected = useMemo(() => {
    if (!catalogQ.data) return selected;
    const next: Record<string, RowSel> = {};
    for (const [rowId, sel] of Object.entries(selected)) {
      const avail = actionsByResource[rowResourceById[rowId] ?? ""] ?? [];
      const actions = sel.actions.filter((action) => avail.includes(action));
      if (actions.length) next[rowId] = { ...sel, actions };
    }
    return next;
  }, [actionsByResource, catalogQ.data, rowResourceById, selected]);

  const scopes = catalogQ.data?.scopes ?? SCOPES;

  function getAvailable(resource: string) {
    return ACTION_ORDER.filter((a) =>
      (actionsByResource[resource] ?? []).includes(a),
    );
  }

  function onNameChange(v: string) {
    setName(v);
    if (!keyTouched) setKey(slugify(v));
  }

  function onKeyChange(v: string) {
    setKey(v);
    setKeyTouched(true);
  }

  function toggleAction(rowId: string, action: string) {
    setSelected((prev) => {
      const cur = prev[rowId]?.actions ?? [];
      const next = cur.includes(action)
        ? cur.filter((a) => a !== action)
        : [...cur, action];
      if (!next.length) {
        const r = { ...prev };
        delete r[rowId];
        return r;
      }
      return {
        ...prev,
        [rowId]: { actions: next, scope: prev[rowId]?.scope ?? "all" },
      };
    });
  }

  function setRowScope(rowId: string, scope: Scope) {
    setSelected((prev) =>
      prev[rowId] ? { ...prev, [rowId]: { ...prev[rowId], scope } } : prev,
    );
  }

  function toggleRow(row: ResourceRow) {
    const avail = getAvailable(row.resource);
    if (!avail.length) return;
    setSelected((prev) => {
      const cur = prev[row.id]?.actions ?? [];
      const allSel = avail.every((a) => cur.includes(a));
      if (allSel) {
        const r = { ...prev };
        delete r[row.id];
        return r;
      }
      return {
        ...prev,
        [row.id]: { actions: avail, scope: prev[row.id]?.scope ?? "all" },
      };
    });
  }

  // Column toggle (scoped to one module) — checks/unchecks one action across all rows.
  function toggleColumn(mod: PermModule, action: string) {
    const eligible = mod.rows.filter((r) =>
      getAvailable(r.resource).includes(action),
    );
    if (!eligible.length) return;
    const allHave = eligible.every((r) =>
      selected[r.id]?.actions.includes(action),
    );
    setSelected((prev) => {
      const next = { ...prev };
      for (const r of eligible) {
        const cur = next[r.id]?.actions ?? [];
        const upd = allHave
          ? cur.filter((a) => a !== action)
          : [...new Set([...cur, action])];
        if (!upd.length) delete next[r.id];
        else next[r.id] = { actions: upd, scope: next[r.id]?.scope ?? "all" };
      }
      return next;
    });
  }

  function getModuleChecked(mod: PermModule): boolean | "indeterminate" {
    const eligible = mod.rows.filter(
      (r) => getAvailable(r.resource).length > 0,
    );
    if (!eligible.length) return false;
    const allSel = eligible.every((r) =>
      getAvailable(r.resource).every((a) =>
        effectiveSelected[r.id]?.actions.includes(a),
      ),
    );
    if (allSel) return true;
    return eligible.some(
      (r) => (effectiveSelected[r.id]?.actions.length ?? 0) > 0,
    )
      ? "indeterminate"
      : false;
  }

  function toggleModule(mod: PermModule) {
    const checked = getModuleChecked(mod);
    setSelected((prev) => {
      const next = { ...prev };
      if (checked === true) {
        for (const r of mod.rows) delete next[r.id];
      } else {
        for (const r of mod.rows) {
          const avail = getAvailable(r.resource);
          if (avail.length)
            next[r.id] = { actions: avail, scope: prev[r.id]?.scope ?? "all" };
        }
      }
      return next;
    });
  }

  function saveDraft() {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ name, key, description, selected: effectiveSelected }),
    );
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 1800);
  }

  const create = useMutation({
    mutationFn: () => {
      const permissions: Grant[] = [];
      for (const mod of modules)
        for (const row of mod.rows) {
          const sel = effectiveSelected[row.id];
          if (!sel?.actions.length) continue;
          for (const action of sel.actions)
            permissions.push({
              resource: row.resource,
              action,
              scope: sel.scope,
            });
        }
      return rbacService.createRole(
        key.trim(),
        name.trim(),
        description.trim(),
        permissions,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      localStorage.removeItem(DRAFT_KEY);
      navigate("/config/roles");
    },
  });

  const canSubmit =
    Boolean(key.trim()) && Boolean(name.trim()) && !create.isPending;
  const totalGrants = Object.values(effectiveSelected).reduce(
    (n, r) => n + r.actions.length,
    0,
  );
  const resourcesGiven = Object.keys(effectiveSelected).length;

  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-stone-50">
      {/* ── Top bar (full-bleed) ── */}
      <div className="flex items-center justify-between gap-4 border-b border-stone-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/config/roles")}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </button>
          <div className="h-5 w-px bg-stone-200" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/20 text-brand-dark">
              <ShieldCheck className="size-3.5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold tracking-tight text-stone-900 truncate">
                {name || "Create New Role"}
              </h1>
              <p className="text-label text-stone-500 truncate">
                {resourcesGiven === 0
                  ? "Define permissions and access scope."
                  : `${totalGrants} permission${totalGrants !== 1 ? "s" : ""} across ${resourcesGiven} resource${resourcesGiven !== 1 ? "s" : ""}.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto modal-scrollbar">
        <div className="mx-auto w-full max-w-375 3xl:max-w-[1800px] 4xl:max-w-full px-6 py-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,340px)_1fr]">
            {/* ── Left: Role Details (sticky) ── */}
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-xl border border-stone-200 bg-white">
                <div className="border-b border-stone-100 px-4 py-3">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-stone-500">
                    Role Details
                  </h2>
                </div>

                <div className="space-y-4 p-4">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="rname"
                      className="text-xs font-medium text-stone-600"
                    >
                      Display name <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="rname"
                      value={name}
                      onChange={(e) => onNameChange(e.target.value)}
                      placeholder="e.g. Sales Rep"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="rkey"
                      className="text-xs font-medium text-stone-600"
                    >
                      Key <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="rkey"
                      value={key}
                      onChange={(e) => onKeyChange(e.target.value)}
                      placeholder="e.g. sales_rep"
                      className="h-9 text-xs font-mono"
                    />
                    {!keyTouched && name && (
                      <p className="text-2xs text-stone-400">
                        Auto-generated — edit to override
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="rdesc"
                      className="text-xs font-medium text-stone-600"
                    >
                      Description
                    </Label>
                    <textarea
                      id="rdesc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional"
                      rows={3}
                      className="w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-xs text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
                    />
                  </div>

                  {/* Live summary */}
                  <div className="rounded-lg bg-stone-50 p-3 border border-stone-100">
                    <p className="text-2xs font-bold uppercase tracking-widest text-stone-400 mb-1.5">
                      Summary
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-base font-bold text-stone-800 leading-none">
                          {resourcesGiven}
                        </p>
                        <p className="text-2xs text-stone-500 mt-0.5">
                          Resources
                        </p>
                      </div>
                      <div>
                        <p className="text-base font-bold text-stone-800 leading-none">
                          {totalGrants}
                        </p>
                        <p className="text-2xs text-stone-500 mt-0.5">
                          Permissions
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            {/* ── Right: Permission Matrix ── */}
            <section className="min-w-0">
              <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
                {/* Section header */}
                <div className="flex items-center justify-between gap-4 border-b border-stone-200 px-4 py-3">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-stone-500">
                      Permissions Matrix
                    </h2>
                    <p className="mt-0.5 text-label text-stone-400">
                      Click column headers to toggle that action across the
                      module. Click row labels to grant everything.
                    </p>
                  </div>
                </div>

                {catalogQ.isLoading && (
                  <div className="p-6">
                    <Spinner label="Loading catalog…" />
                  </div>
                )}
                {catalogQ.isError && (
                  <div className="p-4">
                    <ErrorNote>{apiErrorMessage(catalogQ.error)}</ErrorNote>
                  </div>
                )}

                {/* Modules */}
                {!catalogQ.isLoading && (
                  <div>
                    {modules.map((mod, idx) => {
                      const Icon = mod.icon;
                      const open = openModules[mod.id] ?? true;
                      const modChecked = getModuleChecked(mod);
                      const grantedCount = mod.rows.filter(
                        (r) =>
                          (effectiveSelected[r.id]?.actions.length ?? 0) > 0,
                      ).length;

                      // Columns shown for this module = union of actions for its rows, in canonical order.
                      const cols = ACTION_ORDER.filter((a) =>
                        mod.rows.some((r) =>
                          getAvailable(r.resource).includes(a),
                        ),
                      );

                      return (
                        <div
                          key={mod.id}
                          className={cn(idx > 0 && "border-t border-stone-200")}
                        >
                          {/* Module bar */}
                          <div className="flex items-center gap-3 bg-stone-50/70 px-4 py-2.5">
                            <Checkbox
                              checked={modChecked}
                              onCheckedChange={() => toggleModule(mod)}
                              aria-label={`Select all in ${mod.label}`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setOpenModules((s) => ({
                                  ...s,
                                  [mod.id]: !open,
                                }))
                              }
                              aria-expanded={open}
                              className="flex flex-1 items-center justify-between text-left"
                            >
                              <div className="flex items-center gap-2">
                                <Icon className="size-3.5 text-stone-400" />
                                <span className="text-xs font-bold text-stone-700">
                                  {mod.label}
                                </span>
                                <span className="text-2xs text-stone-400">
                                  {mod.rows.length} resource
                                  {mod.rows.length !== 1 ? "s" : ""}
                                </span>
                                {grantedCount > 0 && (
                                  <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-2xs font-bold text-brand-dark">
                                    {grantedCount}/{mod.rows.length}
                                  </span>
                                )}
                              </div>
                              <ChevronDown
                                className={cn(
                                  "size-3.5 text-stone-400 transition-transform",
                                  open && "rotate-180",
                                )}
                              />
                            </button>
                          </div>

                          {/* Matrix table */}
                          {open && (
                            <div className="overflow-x-auto modal-scrollbar">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-y border-stone-100 bg-white">
                                    <th className="sticky left-0 z-10 bg-white py-2 pl-4 pr-3 text-left text-2xs font-bold uppercase tracking-widest text-stone-400 w-48">
                                      Resource
                                    </th>
                                    {cols.map((action) => {
                                      const eligible = mod.rows.filter((r) =>
                                        getAvailable(r.resource).includes(
                                          action,
                                        ),
                                      );
                                      const allHave =
                                        eligible.length > 0 &&
                                        eligible.every((r) =>
                                          effectiveSelected[
                                            r.id
                                          ]?.actions.includes(action),
                                        );
                                      return (
                                        <th
                                          key={action}
                                          className="w-20 py-2 text-center"
                                        >
                                          <button
                                            type="button"
                                            onClick={() =>
                                              toggleColumn(mod, action)
                                            }
                                            className={cn(
                                              "mx-auto flex items-center justify-center rounded px-2 py-1 text-2xs font-bold uppercase tracking-widest transition",
                                              allHave
                                                ? "bg-brand/15 text-brand-dark hover:bg-brand/25"
                                                : "text-stone-400 hover:bg-stone-100 hover:text-stone-700",
                                            )}
                                            title={`Toggle ${ACTION_LABELS[action]} for all rows`}
                                          >
                                            {ACTION_LABELS[action]}
                                          </button>
                                        </th>
                                      );
                                    })}
                                    <th className="px-3 py-2 text-center text-2xs font-bold uppercase tracking-widest text-stone-400 w-28">
                                      Scope
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {mod.rows.map((row) => {
                                    const available = getAvailable(
                                      row.resource,
                                    );
                                    const checkedActions =
                                      effectiveSelected[row.id]?.actions ?? [];
                                    const scope =
                                      effectiveSelected[row.id]?.scope ?? "all";
                                    const hasAny = checkedActions.length > 0;
                                    const rowAllSelected =
                                      available.length > 0 &&
                                      available.every((a) =>
                                        checkedActions.includes(a),
                                      );

                                    return (
                                      <tr
                                        key={row.id}
                                        className={cn(
                                          "border-t border-stone-50 transition-colors",
                                          hasAny
                                            ? "bg-brand/2"
                                            : "hover:bg-stone-50/60",
                                        )}
                                      >
                                        <td className="sticky left-0 z-10 bg-inherit py-2.5 pl-4 pr-3">
                                          <button
                                            type="button"
                                            onClick={() => toggleRow(row)}
                                            className="block text-left transition hover:opacity-70"
                                            title={
                                              rowAllSelected
                                                ? "Clear row"
                                                : "Grant all actions"
                                            }
                                          >
                                            <p className="text-xs font-semibold text-stone-700">
                                              {row.label}
                                            </p>
                                            <p className="text-2xs font-mono text-stone-400">
                                              {row.resource}
                                            </p>
                                          </button>
                                        </td>

                                        {cols.map((action) => {
                                          const isAvail =
                                            available.includes(action);
                                          const isChk =
                                            checkedActions.includes(action);
                                          return (
                                            <td
                                              key={action}
                                              className="w-20 py-2.5"
                                            >
                                              <div className="flex items-center justify-center">
                                                {isAvail ? (
                                                  <Checkbox
                                                    checked={isChk}
                                                    onCheckedChange={() =>
                                                      toggleAction(
                                                        row.id,
                                                        action,
                                                      )
                                                    }
                                                    aria-label={`${ACTION_LABELS[action]} for ${row.label}`}
                                                  />
                                                ) : (
                                                  <span className="text-stone-200">
                                                    —
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                          );
                                        })}

                                        <td className="px-3 py-2.5">
                                          <select
                                            aria-label={`Scope for ${row.label}`}
                                            value={scope}
                                            disabled={!hasAny}
                                            onChange={(e) =>
                                              setRowScope(
                                                row.id,
                                                e.target.value as Scope,
                                              )
                                            }
                                            className={cn(
                                              "h-7 w-full rounded-md border px-1.5 text-label transition",
                                              "focus:outline-none focus:ring-2 focus:ring-brand/30",
                                              hasAny
                                                ? "border-stone-200 bg-white text-stone-700 hover:border-stone-300 cursor-pointer"
                                                : "border-stone-100 bg-stone-50 text-stone-300 cursor-not-allowed",
                                            )}
                                          >
                                            {scopes.map((s) => (
                                              <option key={s} value={s}>
                                                {SCOPE_LABELS[s]}
                                              </option>
                                            ))}
                                          </select>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* ── Sticky action bar ── */}
      <div className="border-t border-stone-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-375 3xl:max-w-[1800px] 4xl:max-w-full items-center justify-between gap-3 px-6 py-3">
          <div className="min-w-0">
            {create.error && (
              <ErrorNote>{apiErrorMessage(create.error)}</ErrorNote>
            )}
            {draftSaved && !create.error && (
              <p className="text-label font-medium text-emerald-600">
                Draft saved locally.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/config/roles")}
              disabled={create.isPending}
              className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveDraft}
              disabled={create.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
            >
              <Save className="size-3.5" />
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => create.mutate()}
              disabled={!canSubmit}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold shadow-sm transition",
                "bg-brand text-stone-950 hover:bg-brand/80 active:scale-[0.98]",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {create.isPending ? "Creating…" : "Create Role"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
