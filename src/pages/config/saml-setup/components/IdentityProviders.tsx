import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FaAws } from "react-icons/fa";
import { KeyRound, Plus, ArrowRight } from "lucide-react";
import { MicrosoftLogo } from "@/components/icons/MicrosoftLogo";
import { ssoConfigService } from "@/services/ssoConfigService";
import { apiErrorMessage } from "@/api/tenantClient";
import { ErrorNote } from "@/components/tenant/ui";
import { isValidSamlProvider } from "@/lib/ssoConfigForm";
import type { SAMLConfig, SAMLProvider } from "@/types/tenant";
import { ProviderCard, type ProviderCardStatus } from "./ProviderCard";

// The two SAML providers with a dedicated, vendor-specific setup page. Any
// other slug goes through CustomSamlSetupPage instead.
const FIRST_CLASS_PROVIDERS: SAMLProvider[] = ["cognito", "entra"];

export function IdentityProviders() {
  const navigate = useNavigate();
  const [addingCustom, setAddingCustom] = useState(false);
  const [customSlug, setCustomSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);

  const configsQ = useQuery({
    queryKey: ["sso-configs"],
    queryFn: ssoConfigService.list,
  });

  function statusFor(provider: SAMLProvider): ProviderCardStatus | undefined {
    const cfg = configsQ.data?.find(
      (c): c is SAMLConfig => c.provider === provider && c.protocol === "saml",
    );
    if (!cfg) return undefined;
    return cfg.enabled ? "active" : "configured";
  }

  // Already-connected custom providers (anything not entra/cognito) get
  // their own card too -- otherwise there'd be no way back to them beyond
  // remembering the URL.
  const customProviders = (configsQ.data ?? [])
    .filter(
      (c): c is SAMLConfig => c.protocol === "saml" && !FIRST_CLASS_PROVIDERS.includes(c.provider),
    )
    .map((c) => c.provider);

  function handleAddCustom(e: React.FormEvent) {
    e.preventDefault();
    const slug = customSlug.trim().toLowerCase();
    if (!isValidSamlProvider(slug) || FIRST_CLASS_PROVIDERS.includes(slug)) {
      setSlugError(
        "Enter a lowercase slug (letters, digits, hyphens, 2-30 chars, starting with a letter) that isn't entra or cognito.",
      );
      return;
    }
    navigate(`/config/saml-setup/${slug}`);
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-bold text-stone-900">Identity Providers</h2>
        <p className="mt-0.5 text-xs text-stone-500">
          Connect an identity provider to enable SAML sign-in, or select an
          already-configured provider to review and edit its settings.
        </p>
        {configsQ.isError && (
          <div className="mt-2 max-w-md">
            <ErrorNote>{apiErrorMessage(configsQ.error)}</ErrorNote>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 max-w-2xl lg:max-w-4xl">
        <ProviderCard
          to="/config/saml-setup/cognito"
          icon={{ Icon: FaAws, bg: "bg-orange-50", color: "text-[#FF9900]" }}
          label="AWS Cognito"
          description="Connect a Cognito user pool as a SAML identity provider."
          status={statusFor("cognito")}
        />
        <ProviderCard
          to="/config/saml-setup/entra"
          icon={{ Icon: MicrosoftLogo, bg: "bg-stone-50", color: "text-stone-900" }}
          label="Microsoft Entra ID"
          description="Connect a Microsoft Entra ID enterprise application as a SAML identity provider."
          status={statusFor("entra")}
        />

        {customProviders.map((provider) => (
          <ProviderCard
            key={provider}
            to={`/config/saml-setup/${provider}`}
            icon={{ Icon: KeyRound, bg: "bg-stone-50", color: "text-stone-900" }}
            label={provider.charAt(0).toUpperCase() + provider.slice(1)}
            description="Connect this SAML identity provider."
            status={statusFor(provider)}
          />
        ))}

        {addingCustom ? (
          <form
            onSubmit={handleAddCustom}
            className="flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-stone-300 bg-stone-50/60 p-8 text-center"
          >
            <KeyRound className="size-8 text-stone-400" aria-hidden="true" />
            <div className="w-full space-y-1.5">
              <label htmlFor="custom-provider-slug" className="sr-only">
                Custom provider slug
              </label>
              <input
                id="custom-provider-slug"
                type="text"
                autoFocus
                value={customSlug}
                onChange={(e) => {
                  setCustomSlug(e.target.value);
                  setSlugError(null);
                }}
                placeholder="e.g. okta"
                aria-invalid={Boolean(slugError)}
                className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-center text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
              {slugError && <p className="text-2xs text-red-500">{slugError}</p>}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setAddingCustom(false);
                  setCustomSlug("");
                  setSlugError(null);
                }}
                aria-label="Cancel adding a custom provider"
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                aria-label="Continue setting up this custom provider"
                className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 transition hover:bg-brand/80"
              >
                Continue
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAddingCustom(true)}
            aria-label="Add a custom SAML identity provider"
            className="group flex aspect-square flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-stone-300 bg-white p-8 text-center transition-colors hover:border-brand hover:bg-stone-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-50 text-stone-400 transition-colors group-hover:text-brand">
              <Plus className="size-8" />
            </div>
            <div>
              <p className="text-base font-bold text-stone-900">Other provider</p>
              <p className="mt-1.5 text-xs text-stone-500">
                Connect any other SAML 2.0 identity provider (Okta, OneLogin, ADFS, ...).
              </p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
