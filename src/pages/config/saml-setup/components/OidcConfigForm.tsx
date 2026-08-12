import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Loader2 } from "lucide-react";
import { ssoConfigService } from "@/services/ssoConfigService";
import { ssoConfigSchema, ssoConfigErrorMessage, SSO_PROVIDER_LABELS } from "@/lib/ssoConfigForm";
import type { SSOConfigFormValues } from "@/lib/ssoConfigForm";
import { ErrorNote } from "@/components/tenant/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { OIDCConfig, SSOProvider } from "@/types/tenant";
import { EnabledToggle } from "./EnabledToggle";

interface OidcConfigFormProps {
  mode: "create" | "edit";
  config: OIDCConfig | null;
  availableProviders: SSOProvider[];
  onClose: () => void;
}

// The OIDC field set + save mutation, extracted from what was previously
// the whole of SsoConfigModal — unchanged behavior, just protocol-scoped so
// the shell can switch between this and SamlConfigForm.
export function OidcConfigForm({ mode, config, availableProviders, onClose }: OidcConfigFormProps) {
  const qc = useQueryClient();
  const isCreate = mode === "create";

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SSOConfigFormValues>({
    resolver: zodResolver(ssoConfigSchema(isCreate)) as unknown as Resolver<SSOConfigFormValues>,
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
            protocol: "oidc",
            provider: data.provider,
            clientId: data.clientId,
            clientSecret: data.clientSecret ?? "",
            issuer: data.issuer,
            redirectUri: data.redirectUri,
            enabled: data.enabled,
          })
        : ssoConfigService.update(config?.id ?? "", {
            protocol: "oidc",
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

  return (
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
          Used once SSO sign-in is available for this provider — not yet
          active for OIDC.
        </p>
        {errors.redirectUri && (
          <p className="text-xs text-red-500">{errors.redirectUri.message}</p>
        )}
      </div>

      <EnabledToggle
        register={register}
        control={control}
        watchName="enabled"
        hint="Only saves your intent right now — sign-in via SSO isn't wired up yet for OIDC."
      />

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
  );
}
