import { FaAws } from "react-icons/fa";
import { MicrosoftLogo } from "@/components/icons/MicrosoftLogo";
import { ProviderCard } from "./ProviderCard";

export function SetupGuidesTab() {
  return (
    <div>
      <div className="mb-4">
        <p className="mt-0.5 text-xs text-stone-500">
          Choose the identity provider you want to connect with StoneSuite.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 max-w-2xl">
        <ProviderCard
          to="/config/saml-setup/cognito"
          icon={FaAws}
          iconBg="bg-orange-50"
          iconColor="text-[#FF9900]"
          label="AWS Cognito"
          description="Connect a Cognito user pool as a SAML identity provider."
        />
        <ProviderCard
          to="/config/saml-setup/entra"
          icon={MicrosoftLogo}
          iconBg="bg-stone-50"
          iconColor="text-stone-900"
          label="Microsoft Entra ID"
          description="Connect a Microsoft Entra ID enterprise application as a SAML identity provider."
        />
      </div>
    </div>
  );
}
