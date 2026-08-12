import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2 } from "lucide-react";
import { ssoConfigService } from "@/services/ssoConfigService";
import { samlConfigSchema } from "@/lib/ssoConfigForm";
import type { SAMLConfigFormValues } from "@/lib/ssoConfigForm";
import { ssoConfigErrorMessage } from "@/lib/ssoConfigForm";
import { Spinner, ErrorNote } from "@/components/tenant/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SAMLConfig, SAMLProvider } from "@/types/tenant";
import { SamlDerivedFields } from "./SamlDerivedFields";
import { EnabledToggle } from "./EnabledToggle";

const PROVIDER_COPY: Record<SAMLProvider, { name: string; metadataPlaceholder: string }> = {
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

interface SamlConnectFormProps {
  provider: SAMLProvider;
}

export function SamlConnectForm({ provider }: SamlConnectFormProps) {
  const qc = useQueryClient();
  const copy = PROVIDER_COPY[provider];

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
    defaultValues: { provider, metadataUrl: "", enabled: false },
  });

  // Prefill once the existing config loads (or is confirmed absent) —
  // configsQ resolves after mount, so the form starts empty and adopts the
  // fetched values here rather than depending on a prop that isn't available yet.
  useEffect(() => {
    if (existing) {
      reset({ provider, metadataUrl: existing.metadataUrl, enabled: existing.enabled });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, existing?.metadataUrl, existing?.enabled]);

  const save = useMutation({
    mutationFn: (data: SAMLConfigFormValues) => {
      const payload = { protocol: "saml" as const, provider, metadataUrl: data.metadataUrl, enabled: data.enabled };
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

  const onSubmit = (data: SAMLConfigFormValues) => save.mutate(data);

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

        {errors.root && <ErrorNote>{errors.root.message}</ErrorNote>}
        {configsQ.isError && (
          <ErrorNote>{ssoConfigErrorMessage(configsQ.error)}</ErrorNote>
        )}

        <div className="flex justify-end pt-1">
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
    </div>
  );
}
