import { useQuery } from "@tanstack/react-query";
import { FaAws } from "react-icons/fa";
import { MicrosoftLogo } from "@/components/icons/MicrosoftLogo";
import { ssoConfigService } from "@/services/ssoConfigService";
import { apiErrorMessage } from "@/api/tenantClient";
import { ErrorNote } from "@/components/tenant/ui";
import type { SAMLConfig, SAMLProvider } from "@/types/tenant";
import { ProviderCard, type ProviderCardStatus } from "./ProviderCard";

export function IdentityProviders() {
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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 max-w-2xl">
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
      </div>
    </div>
  );
}
