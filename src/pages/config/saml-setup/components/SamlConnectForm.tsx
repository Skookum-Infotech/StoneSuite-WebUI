import { useState } from "react";
import { Lock, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SamlProvider = "cognito" | "entra";

const PROVIDER_COPY: Record<
  SamlProvider,
  { name: string; metadataPlaceholder: string }
> = {
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
  provider: SamlProvider;
}

export function SamlConnectForm({ provider }: SamlConnectFormProps) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [metadataUrl, setMetadataUrl] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [enabled, setEnabled] = useState(false);
  const copy = PROVIDER_COPY[provider];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-stone-900">Connect StoneSuite</h3>
          <p className="mt-0.5 text-xs text-stone-500">
            Enter the values from your {copy.name} SAML identity provider.
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-2xs font-semibold text-stone-500">
          <Clock className="size-3" />
          Coming soon
        </span>
      </div>

      <div className="space-y-4">
        {provider === "cognito" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="cognito-client-id">Client ID</Label>
              <Input
                id="cognito-client-id"
                type="text"
                placeholder="e.g. 3n4b5c6d7e8f9g0h1i2j3k4l5m"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cognito-client-secret">Client secret</Label>
              <Input
                id="cognito-client-secret"
                type="password"
                autoComplete="new-password"
                placeholder="Enter client secret"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="h-10"
              />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label htmlFor={`${provider}-metadata-url`}>
            SAML 2.0 metadata document URL
          </Label>
          <Input
            id={`${provider}-metadata-url`}
            type="text"
            placeholder={copy.metadataPlaceholder}
            value={metadataUrl}
            onChange={(e) => setMetadataUrl(e.target.value)}
            className="h-10"
          />
        </div>

        {provider === "cognito" && (
          <div className="space-y-1.5">
            <Label htmlFor="cognito-redirect-uri">Redirect URI</Label>
            <Input
              id="cognito-redirect-uri"
              type="text"
              placeholder="https://app.stonesuite.io/auth/sso/callback"
              value={redirectUri}
              onChange={(e) => setRedirectUri(e.target.value)}
              className="h-10"
            />
          </div>
        )}

        <div className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-stone-700">Enabled</p>
            <p className="mt-0.5 text-2xs text-stone-400">
              Preview only — this configuration isn&apos;t saved yet.
            </p>
          </div>
          <label className="cursor-pointer shrink-0" aria-label="Toggle SAML provider enabled">
            <input
              type="checkbox"
              className="sr-only"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
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

        <div className="flex justify-end pt-1">
          <button
            type="button"
            disabled
            aria-label="Save SAML configuration (not available yet)"
            title="This step isn't wired up yet — nothing entered above is saved."
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-stone-200 px-4 py-2 text-sm font-semibold text-stone-400"
          >
            <Lock className="size-3.5" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
