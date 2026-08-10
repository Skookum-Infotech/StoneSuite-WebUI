import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ssoConfigService } from "@/services/ssoConfigService";
import {
  ssoConfigSchema,
  ssoConfigErrorMessage,
  SSO_PROVIDER_LABELS,
} from "@/lib/ssoConfigForm";
import type { SSOConfigFormValues } from "@/lib/ssoConfigForm";
import { ErrorNote } from "@/components/tenant/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { SSOConfig, SSOProvider } from "@/types/tenant";

interface SsoConfigModalProps {
  mode: "create" | "edit";
  config: SSOConfig | null;
  availableProviders: SSOProvider[];
  onClose: () => void;
}

export function SsoConfigModal({
  mode,
  config,
  availableProviders,
  onClose,
}: SsoConfigModalProps) {
  const qc = useQueryClient();
  const isCreate = mode === "create";

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SSOConfigFormValues>({
    resolver: zodResolver(
      ssoConfigSchema(isCreate),
    ) as unknown as Resolver<SSOConfigFormValues>,
    defaultValues: {
      provider: config?.provider ?? availableProviders[0],
      clientId: config?.clientId ?? "",
      clientSecret: "",
      issuer: config?.issuer ?? "",
      redirectUri: config?.redirectUri ?? "",
      enabled: config?.enabled ?? false,
    },
  });

  const save = useMutation({
    mutationFn: (data: SSOConfigFormValues) =>
      isCreate
        ? ssoConfigService.create({
            provider: data.provider,
            clientId: data.clientId,
            clientSecret: data.clientSecret ?? "",
            issuer: data.issuer,
            redirectUri: data.redirectUri,
            enabled: data.enabled,
          })
        : ssoConfigService.update(config?.id ?? "", {
            provider: config?.provider ?? data.provider,
            clientId: data.clientId,
            clientSecret: data.clientSecret,
            issuer: data.issuer,
            redirectUri: data.redirectUri,
            enabled: data.enabled,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sso-configs"] });
      onClose();
    },
    onError: (err: unknown) => {
      setError("root", { message: ssoConfigErrorMessage(err) });
    },
  });

  const onSubmit = (data: SSOConfigFormValues) => save.mutate(data);

  const enabled = Boolean(useWatch({ control, name: "enabled" }));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={isCreate ? "Add SSO provider" : "Edit SSO provider"}
    >
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto modal-scrollbar">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              {isCreate ? "Add SSO provider" : "Edit SSO provider"}
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Stores connection settings only — sign-in via SSO isn&apos;t
              available yet.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sso-provider">Provider</Label>
            {isCreate ? (
              <select
                id="sso-provider"
                {...register("provider")}
                className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/50"
              >
                {availableProviders.map((p) => (
                  <option key={p} value={p}>
                    {SSO_PROVIDER_LABELS[p]}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input type="hidden" {...register("provider")} />
                <p
                  id="sso-provider"
                  className="flex h-10 w-full items-center rounded-lg border border-transparent bg-stone-50 px-3 text-sm text-stone-500"
                >
                  {config ? SSO_PROVIDER_LABELS[config.provider] : ""}
                </p>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sso-client-id">
              Client ID <span className="text-red-500">*</span>
            </Label>
            <Input
              id="sso-client-id"
              type="text"
              placeholder="e.g. 00000000-0000-0000-0000-000000000000"
              aria-invalid={Boolean(errors.clientId)}
              {...register("clientId")}
              className="h-10"
            />
            {errors.clientId && (
              <p className="text-xs text-red-500">{errors.clientId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sso-client-secret">
              {isCreate ? (
                <>
                  Client secret <span className="text-red-500">*</span>
                </>
              ) : (
                "New client secret"
              )}
            </Label>
            <Input
              id="sso-client-secret"
              type="password"
              autoComplete="new-password"
              placeholder={isCreate ? "Enter client secret" : "Leave blank to keep the existing secret"}
              aria-invalid={Boolean(errors.clientSecret)}
              {...register("clientSecret")}
              className="h-10"
            />
            {!isCreate && (
              <p className="text-2xs text-stone-400">
                A secret is already configured. Enter a new one only to
                replace it — it&apos;s never shown once saved.
              </p>
            )}
            {errors.clientSecret && (
              <p className="text-xs text-red-500">{errors.clientSecret.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sso-issuer">
              Issuer <span className="text-stone-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="sso-issuer"
              type="text"
              placeholder="https://login.example.com/tenant-id/v2.0"
              aria-invalid={Boolean(errors.issuer)}
              {...register("issuer")}
              className="h-10"
            />
            {errors.issuer && (
              <p className="text-xs text-red-500">{errors.issuer.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sso-redirect-uri">
              Redirect URI <span className="text-stone-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="sso-redirect-uri"
              type="text"
              placeholder="https://app.example.com/auth/sso/callback"
              aria-invalid={Boolean(errors.redirectUri)}
              {...register("redirectUri")}
              className="h-10"
            />
            <p className="text-2xs text-stone-400">
              Used once SSO sign-in is available — not yet active.
            </p>
            {errors.redirectUri && (
              <p className="text-xs text-red-500">{errors.redirectUri.message}</p>
            )}
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold text-stone-700">Enabled</p>
              <p className="mt-0.5 text-2xs text-stone-400">
                Only saves your intent right now — sign-in via SSO isn&apos;t
                wired up yet.
              </p>
            </div>
            <label
              className="cursor-pointer shrink-0"
              aria-label="Toggle SSO provider enabled"
            >
              <input type="checkbox" className="sr-only" {...register("enabled")} />
              <div
                className={cn(
                  "relative h-5 w-9 rounded-full transition-colors duration-200",
                  enabled ? "bg-brand" : "bg-stone-200",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                    enabled ? "left-[18px]" : "left-0.5",
                  )}
                />
              </div>
            </label>
          </div>

          {errors.root && <ErrorNote>{errors.root.message}</ErrorNote>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
            >
              Cancel
            </button>
            <Button type="submit" disabled={isSubmitting} className="h-9 gap-2">
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
