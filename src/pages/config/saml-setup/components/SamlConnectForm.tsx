import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { ssoConfigService } from "@/services/ssoConfigService";
import { rbacService } from "@/services/tenantServices";
import { samlConfigSchema } from "@/lib/ssoConfigForm";
import type { SAMLConfigFormValues } from "@/lib/ssoConfigForm";
import { ssoConfigErrorMessage } from "@/lib/ssoConfigForm";
import { apiErrorMessage } from "@/api/tenantClient";
import { cn } from "@/lib/utils";
import { Spinner, ErrorNote } from "@/components/tenant/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SAMLConfig, SAMLProvider } from "@/types/tenant";
import { SamlDerivedFields } from "./SamlDerivedFields";
import { EnabledToggle } from "./EnabledToggle";

// Partial, not exhaustive: SAMLProvider also accepts a custom slug (see its
// definition in types/tenant.ts) that has no entry here, and falls back to
// defaultProviderCopy below.
const PROVIDER_COPY: Partial<Record<string, { name: string; metadataPlaceholder: string }>> = {
  cognito: {
    name: "AWS Cognito",
    metadataPlaceholder:
      "https://cognito-idp.us-east-1.amazonaws.com/.../saml2/metadata",
  },
  entra: {
    name: "Microsoft Entra ID",
    metadataPlaceholder:
      "https://login.microsoftonline.com/.../federationmetadata/2007-06/federationmetadata.xml",
  },
};

function defaultProviderCopy(provider: string): { name: string; metadataPlaceholder: string } {
  return {
    name: provider.charAt(0).toUpperCase() + provider.slice(1),
    metadataPlaceholder: "https://your-identity-provider.example.com/saml/metadata",
  };
}

interface SamlConnectFormProps {
  provider: SAMLProvider;
}

export function SamlConnectForm({ provider }: SamlConnectFormProps) {
  const qc = useQueryClient();
  const copy = PROVIDER_COPY[provider] ?? defaultProviderCopy(provider);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const configsQ = useQuery({
    queryKey: ["sso-configs"],
    queryFn: ssoConfigService.list,
  });
  const existing = configsQ.data?.find(
    (c): c is SAMLConfig => c.provider === provider && c.protocol === "saml",
  );
  const isCreate = !existing;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SAMLConfigFormValues>({
    resolver: zodResolver(samlConfigSchema()),
    defaultValues: { provider, metadataUrl: "", enabled: false, defaultRoleId: "" },
  });

  // Prefill once the existing config loads (or is confirmed absent) —
  // configsQ resolves after mount, so the form starts empty and adopts the
  // fetched values here rather than depending on a prop that isn't available
  // yet. Also re-runs on delete, when `existing` disappears, so the form
  // clears back to blank instead of leaving stale values behind.
  useEffect(() => {
    if (existing) {
      reset({
        provider,
        metadataUrl: existing.metadataUrl,
        enabled: existing.enabled,
        defaultRoleId: existing.defaultRoleId,
      });
    } else {
      reset({ provider, metadataUrl: "", enabled: false, defaultRoleId: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, existing?.metadataUrl, existing?.enabled, existing?.defaultRoleId]);

  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: rbacService.listRoles });
  // System roles (e.g. super_admin) are rejected server-side as a default SSO
  // role -- filter them out so the dropdown never offers a choice that would
  // just 403 on save.
  const assignableRoles = (rolesQ.data ?? []).filter((role) => !role.isSystem);

  const save = useMutation({
    mutationFn: (data: SAMLConfigFormValues) => {
      const payload = {
        protocol: "saml" as const,
        provider,
        metadataUrl: data.metadataUrl,
        enabled: data.enabled,
        defaultRoleId: data.defaultRoleId,
      };
      return existing ? ssoConfigService.update(existing.id, payload) : ssoConfigService.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sso-configs"] });
    },
    onError: (err: unknown) => {
      setError("root", { message: ssoConfigErrorMessage(err) });
    },
  });

  const refresh = useMutation({
    mutationFn: () => {
      if (!existing) throw new Error("No SAML configuration to refresh.");
      return ssoConfigService.refreshMetadata(existing.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sso-configs"] });
    },
  });

  const del = useMutation({
    mutationFn: () => {
      if (!existing) throw new Error("No SAML configuration to delete.");
      return ssoConfigService.remove(existing.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sso-configs"] });
      setConfirmingDelete(false);
    },
  });

  const onSubmit = (data: SAMLConfigFormValues) => save.mutate(data);

  useEffect(() => {
    if (!confirmingDelete) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmingDelete(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [confirmingDelete]);

  if (configsQ.isLoading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <Spinner label="Loading configuration…" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-stone-900">Connect StoneSuite</h3>
        <p className="mt-0.5 text-xs text-stone-500">
          Enter the values from your {copy.name} SAML identity provider.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${provider}-metadata-url`}>
            SAML 2.0 metadata document URL <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`${provider}-metadata-url`}
            type="text"
            placeholder={copy.metadataPlaceholder}
            aria-invalid={Boolean(errors.metadataUrl)}
            {...register("metadataUrl")}
            className="h-10"
          />
          {errors.metadataUrl && (
            <p className="text-xs text-red-500">{errors.metadataUrl.message}</p>
          )}
        </div>

        <EnabledToggle
          register={register}
          control={control}
          watchName="enabled"
          hint="Allow sign-in via this identity provider once configured."
        />

        <div className="space-y-1.5">
          <Label htmlFor={`${provider}-default-role`}>Default role for new sign-ins</Label>
          <select
            id={`${provider}-default-role`}
            {...register("defaultRoleId")}
            className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/50"
          >
            <option value="">No role — assign manually after sign-in</option>
            {assignableRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <p className="text-2xs text-stone-400">
            Granted automatically to anyone signing in for the first time through this provider.
          </p>
        </div>

        {errors.root && <ErrorNote>{errors.root.message}</ErrorNote>}
        {configsQ.isError && (
          <ErrorNote>{ssoConfigErrorMessage(configsQ.error)}</ErrorNote>
        )}

        <div className={cn("flex items-center pt-1", existing ? "justify-between" : "justify-end")}>
          {existing && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label="Delete SAML configuration"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
            >
              <Trash2 className="size-3.5" />
              Delete
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            aria-label={isCreate ? "Save SAML configuration" : "Update SAML configuration"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-brand/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            {isSubmitting ? "Saving…" : isCreate ? "Save" : "Update"}
          </button>
        </div>
      </form>

      {existing && (
        <div className="mt-4">
          <SamlDerivedFields
            config={existing}
            onRefresh={() => refresh.mutate()}
            isRefreshing={refresh.isPending}
          />
          {refresh.isError && (
            <div className="mt-2">
              <ErrorNote>{ssoConfigErrorMessage(refresh.error)}</ErrorNote>
            </div>
          )}
        </div>
      )}

      {confirmingDelete && existing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-saml-config-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmingDelete(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="size-4 text-red-500" />
              </span>
              <div>
                <h3 id="delete-saml-config-title" className="text-sm font-bold text-stone-900">
                  Delete SAML configuration?
                </h3>
                <p className="mt-1 text-xs text-stone-500 leading-relaxed">
                  The {copy.name} configuration will be permanently removed
                  {existing.enabled ? " and users will no longer be able to sign in with it" : ""}.
                  This cannot be undone.
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
                autoFocus
                onClick={() => setConfirmingDelete(false)}
                disabled={del.isPending}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => del.mutate()}
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
