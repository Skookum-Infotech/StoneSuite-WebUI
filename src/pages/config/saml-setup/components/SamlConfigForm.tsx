import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Loader2 } from "lucide-react";
import { ssoConfigService } from "@/services/ssoConfigService";
import { samlConfigSchema, ssoConfigErrorMessage } from "@/lib/ssoConfigForm";
import type { SAMLConfigFormValues } from "@/lib/ssoConfigForm";
import { ErrorNote } from "@/components/tenant/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { SAMLConfig, SAMLProvider } from "@/types/tenant";
import { EnabledToggle } from "./EnabledToggle";
import { SamlDerivedFields } from "./SamlDerivedFields";

interface SamlConfigFormProps {
  mode: "create" | "edit";
  config: SAMLConfig | null;
  availableProviders: SAMLProvider[];
  onClose: () => void;
}

// The SAML field set + save mutation — only metadata_url is caller-supplied,
// every other IdP field is derived server-side on save (see SamlDerivedFields).
export function SamlConfigForm({ mode, config, availableProviders, onClose }: SamlConfigFormProps) {
  const qc = useQueryClient();
  const isCreate = mode === "create";

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SAMLConfigFormValues>({
    resolver: zodResolver(samlConfigSchema()),
    defaultValues: {
      provider: config?.provider ?? availableProviders[0],
      metadataUrl: config?.metadataUrl ?? "",
      enabled: config?.enabled ?? false,
    },
  });

  const save = useMutation({
    mutationFn: (data: SAMLConfigFormValues) => {
      const payload = { protocol: "saml" as const, provider: data.provider, metadataUrl: data.metadataUrl, enabled: data.enabled };
      return config ? ssoConfigService.update(config.id, payload) : ssoConfigService.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sso-configs"] });
      onClose();
    },
    onError: (err: unknown) => {
      setError("root", { message: ssoConfigErrorMessage(err) });
    },
  });

  const refresh = useMutation({
    mutationFn: () => {
      if (!config) throw new Error("No SAML configuration to refresh.");
      return ssoConfigService.refreshMetadata(config.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sso-configs"] });
    },
  });

  const onSubmit = (data: SAMLConfigFormValues) => save.mutate(data);

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="saml-provider">Provider</Label>
          {isCreate ? (
            <select
              id="saml-provider"
              {...register("provider")}
              className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/50"
            >
              {availableProviders.map((p) => (
                <option key={p} value={p}>
                  {p === "entra" ? "Microsoft Entra ID" : "Amazon Cognito"}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input type="hidden" {...register("provider")} />
              <p
                id="saml-provider"
                className="flex h-10 w-full items-center rounded-lg border border-transparent bg-stone-50 px-3 text-sm text-stone-500"
              >
                {config && (config.provider === "entra" ? "Microsoft Entra ID" : "Amazon Cognito")}
              </p>
            </>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="saml-metadata-url">
            SAML 2.0 metadata document URL <span className="text-red-500">*</span>
          </Label>
          <Input
            id="saml-metadata-url"
            type="text"
            placeholder="https://login.microsoftonline.com/.../federationmetadata/2007-06/federationmetadata.xml"
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

      {config && (
        <>
          <SamlDerivedFields
            config={config}
            onRefresh={() => refresh.mutate()}
            isRefreshing={refresh.isPending}
          />
          {refresh.isError && <ErrorNote>{ssoConfigErrorMessage(refresh.error)}</ErrorNote>}
        </>
      )}
    </div>
  );
}
