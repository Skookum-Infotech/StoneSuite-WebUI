import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { ssoConfigService } from "@/services/ssoConfigService";
import { apiErrorMessage } from "@/api/tenantClient";
import { Spinner, ErrorNote, EmptyState, Badge } from "@/components/tenant/ui";
import { SSO_PROVIDERS, SSO_PROVIDER_LABELS, ssoConfigErrorMessage } from "@/lib/ssoConfigForm";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import type { SSOConfig, SSOProvider } from "@/types/tenant";
import { SsoConfigModal } from "./SsoConfigModal";

const GRID_COLUMNS =
  "minmax(120px,0.9fr) 70px minmax(140px,1.3fr) minmax(160px,1.5fr) 90px 120px";

export function ConfiguredProvidersTab() {
  const qc = useQueryClient();
  const { hasPermission, isLoading: permsLoading } = useUserPermissions();
  const canConfigure = permsLoading || hasPermission("sso_config", "configure");

  const configsQ = useQuery({
    queryKey: ["sso-configs"],
    queryFn: ssoConfigService.list,
  });
  const configs = configsQ.data ?? [];

  // A provider slot is shared across protocols (backend: unique per
  // tenant+provider regardless of protocol) — one config of either kind
  // takes it, so filtering by provider alone (not provider+protocol) is
  // correct here.
  const availableProviders: SSOProvider[] = SSO_PROVIDERS.filter(
    (p) => !configs.some((c) => c.provider === p),
  );

  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingConfig, setEditingConfig] = useState<SSOConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SSOConfig | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => ssoConfigService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sso-configs"] });
      setDeleteTarget(null);
    },
  });

  const refresh = useMutation({
    mutationFn: (id: string) => ssoConfigService.refreshMetadata(id),
    onMutate: (id: string) => setRefreshingId(id),
    onSettled: () => setRefreshingId(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sso-configs"] });
    },
  });

  function openCreate() {
    setEditingConfig(null);
    setModalMode("create");
  }
  function openEdit(cfg: SSOConfig) {
    setEditingConfig(cfg);
    setModalMode("edit");
  }
  function closeModal() {
    setModalMode(null);
    setEditingConfig(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-stone-900">Configured providers</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            SAML providers are fully wired for sign-in. OIDC providers store
            connection settings only — sign-in via OIDC isn&apos;t available
            yet.
          </p>
        </div>
        {canConfigure && availableProviders.length > 0 && (
          <button
            type="button"
            onClick={openCreate}
            aria-label="Add SSO provider"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-stone-950 shadow-sm transition hover:bg-brand/80"
          >
            <Plus className="size-3.5" />
            Add provider
          </button>
        )}
      </div>

      {configsQ.isLoading && (
        <div className="flex items-center justify-center h-40">
          <Spinner label="Loading SSO configurations…" />
        </div>
      )}
      {configsQ.isError && (
        <div className="max-w-lg">
          <ErrorNote>{apiErrorMessage(configsQ.error)}</ErrorNote>
        </div>
      )}
      {!configsQ.isLoading && !configsQ.isError && configs.length === 0 && (
        <EmptyState>
          No SSO providers configured yet.{" "}
          {canConfigure ? 'Click "Add provider" to set one up.' : ""}
        </EmptyState>
      )}

      {configs.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto modal-scrollbar">
            <div style={{ minWidth: "900px" }}>
              <div
                className="grid items-center px-5 py-3 bg-stone-50 border-b border-stone-200 gap-3 text-2xs font-bold uppercase tracking-widest text-stone-400 select-none"
                style={{ gridTemplateColumns: GRID_COLUMNS }}
              >
                <span>Provider</span>
                <span>Protocol</span>
                <span>{"Client ID / IdP entity"}</span>
                <span>{"Issuer / SSO URL"}</span>
                <span className="text-center">Enabled</span>
                <span />
              </div>

              {configs.map((cfg, idx) => (
                <div
                  key={cfg.id}
                  className="grid items-center px-5 py-3 gap-3"
                  style={{
                    gridTemplateColumns: GRID_COLUMNS,
                    borderBottom:
                      idx === configs.length - 1 ? undefined : "1px solid rgb(245 245 244)",
                  }}
                >
                  <span className="text-xs font-semibold text-stone-800">
                    {SSO_PROVIDER_LABELS[cfg.provider]}
                  </span>
                  <span>
                    <Badge size="sm" color={cfg.protocol === "saml" ? "#0d9488" : undefined}>
                      {cfg.protocol.toUpperCase()}
                    </Badge>
                  </span>
                  {cfg.protocol === "saml" ? (
                    <span className="font-mono text-2xs text-stone-500 truncate" title={cfg.idpEntityId || undefined}>
                      {cfg.idpEntityId || "—"}
                    </span>
                  ) : (
                    <span className="font-mono text-2xs text-stone-500 truncate" title={cfg.clientId}>
                      {cfg.clientId}
                    </span>
                  )}
                  {cfg.protocol === "saml" ? (
                    <span className="text-2xs text-stone-400 truncate" title={cfg.ssoUrl || undefined}>
                      {cfg.ssoUrl || "—"}
                    </span>
                  ) : (
                    <span className="text-2xs text-stone-400 truncate" title={cfg.issuer || undefined}>
                      {cfg.issuer || "—"}
                    </span>
                  )}
                  <span className="flex justify-center">
                    {cfg.enabled ? (
                      <Badge color="#16a34a">Enabled</Badge>
                    ) : (
                      <Badge>Disabled</Badge>
                    )}
                  </span>
                  <span className="flex items-center justify-end gap-1">
                    {canConfigure && cfg.protocol === "saml" && (
                      <button
                        type="button"
                        onClick={() => refresh.mutate(cfg.id)}
                        disabled={refreshingId === cfg.id}
                        aria-label={`Refresh ${SSO_PROVIDER_LABELS[cfg.provider]} metadata`}
                        className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {refreshingId === cfg.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                      </button>
                    )}
                    {canConfigure && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(cfg)}
                          aria-label={`Edit ${SSO_PROVIDER_LABELS[cfg.provider]} configuration`}
                          className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(cfg)}
                          aria-label={`Delete ${SSO_PROVIDER_LABELS[cfg.provider]} configuration`}
                          className="rounded-lg p-1.5 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {refresh.isError && (
            <div className="px-5 py-3 border-t border-stone-100">
              <ErrorNote>{ssoConfigErrorMessage(refresh.error)}</ErrorNote>
            </div>
          )}
        </div>
      )}

      {modalMode && (
        <SsoConfigModal
          mode={modalMode}
          config={editingConfig}
          availableProviders={availableProviders}
          onClose={closeModal}
        />
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-sso-config-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="size-4 text-red-500" />
              </span>
              <div>
                <h3 id="delete-sso-config-title" className="text-sm font-bold text-stone-900">
                  Delete SSO configuration?
                </h3>
                <p className="mt-1 text-xs text-stone-500 leading-relaxed">
                  The{" "}
                  <span className="font-semibold text-stone-700">
                    {SSO_PROVIDER_LABELS[deleteTarget.provider]}
                  </span>{" "}
                  configuration will be permanently removed
                  {deleteTarget.protocol === "saml" && deleteTarget.enabled
                    ? " and users will no longer be able to sign in with it"
                    : ""}
                  . This cannot be undone.
                </p>
                {del.error && (
                  <div className="mt-2">
                    <ErrorNote>{apiErrorMessage(del.error)}</ErrorNote>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={del.isPending}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => del.mutate(deleteTarget.id)}
                disabled={del.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                {del.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
