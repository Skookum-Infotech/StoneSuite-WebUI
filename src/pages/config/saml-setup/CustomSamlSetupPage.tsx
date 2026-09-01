import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Info, ChevronLeft } from "lucide-react";
import { SetupStep, StepChip } from "./components/SetupStep";
import { CopyField } from "./components/CopyField";
import { AttributeMappingTable } from "./components/AttributeMappingTable";
import { SamlConnectForm } from "./components/SamlConnectForm";
import { SsoDomainsCard } from "./components/SsoDomainsCard";
import { SsoSignInLink } from "./components/SsoSignInLink";
import { samlAuthService } from "@/services/samlAuthService";
import { apiErrorMessage } from "@/api/tenantClient";
import { Spinner, ErrorNote } from "@/components/tenant/ui";
import { isValidSamlProvider } from "@/lib/ssoConfigForm";
import type { SAMLProvider } from "@/types/tenant";

// entra/cognito have their own dedicated, vendor-specific walkthrough pages
// (EntraSamlSetupPage/CognitoSamlSetupPage) -- this page is only for
// everything else.
const FIRST_CLASS_PROVIDERS = ["entra", "cognito"];

export default function CustomSamlSetupPage(): React.JSX.Element {
  const { provider: rawProvider } = useParams<{ provider: string }>();
  const provider = (rawProvider ?? "").trim().toLowerCase();

  if (FIRST_CLASS_PROVIDERS.includes(provider)) {
    return <Navigate to={`/config/saml-setup/${provider}`} replace />;
  }
  if (!isValidSamlProvider(provider)) {
    return <Navigate to="/config/saml-setup" replace />;
  }

  return <CustomSamlSetupPageContent provider={provider} />;
}

function CustomSamlSetupPageContent({ provider }: { provider: SAMLProvider }) {
  const label = provider.charAt(0).toUpperCase() + provider.slice(1);
  const spInfoQ = useQuery({
    queryKey: ["saml-sp-info", provider],
    queryFn: () => samlAuthService.spInfo(provider),
  });

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-stone-50/60">
      <div className="bg-background border-b border-stone-200 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center justify-between gap-3.5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-50 border border-stone-200">
              <KeyRound className="size-5 text-stone-900" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-stone-900">
                SAML Setup
              </h1>
              <p className="text-xs text-stone-500 mt-0.5">
                Connect {label} as a SAML identity provider for StoneSuite.
              </p>
            </div>
          </div>
          <Link
            to="/config/saml-setup"
            aria-label="Back to identity providers"
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
          >
            <ChevronLeft className="size-3.5" />
            Identity providers
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto modal-scrollbar">
        <div className="mx-auto w-full max-w-[1500px] 3xl:max-w-[1800px] 4xl:max-w-full px-6 py-6">
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-5">
              <section className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
                <h2 className="mb-5 text-base font-bold text-stone-900">
                  Set up {label} SAML
                </h2>
                <ol>
                  <SetupStep
                    number={1}
                    title={`Create a new SAML 2.0 application in ${label}, for StoneSuite`}
                  >
                    <p className="flex items-start gap-2 text-xs text-stone-500">
                      <Info className="mt-0.5 size-3.5 shrink-0 text-stone-400" />
                      StoneSuite does not support identity provider-initiated
                      flows — if {label} offers a &quot;test&quot; or
                      &quot;preview&quot; sign-in button, it will not work.
                      Sign-in must start from StoneSuite&apos;s own login page.
                    </p>
                  </SetupStep>
                  <SetupStep
                    number={2}
                    isLast
                    title="Set the following values in the application's SAML configuration"
                  >
                    {spInfoQ.isLoading && <Spinner label="Loading StoneSuite values…" />}
                    {spInfoQ.isError && <ErrorNote>{apiErrorMessage(spInfoQ.error)}</ErrorNote>}
                    {spInfoQ.data && (
                      <>
                        <CopyField
                          label="Entity ID / Identifier / Audience URI"
                          value={spInfoQ.data.spEntityId}
                        />
                        <CopyField
                          label="ACS URL / Reply URL / Recipient URL"
                          value={spInfoQ.data.acsUrl}
                        />
                      </>
                    )}
                  </SetupStep>
                </ol>
              </section>

              <section className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
                <h2 className="mb-5 text-base font-bold text-stone-900">
                  Configure attributes
                </h2>
                <ol>
                  <SetupStep
                    number={3}
                    title={
                      <>
                        Set the <StepChip>Name ID</StepChip> format to{" "}
                        <StepChip>EmailAddress</StepChip>, mapped to the
                        user&apos;s unique email address
                      </>
                    }
                  />
                  <SetupStep
                    number={4}
                    isLast
                    title="Add the following attribute (claim) mappings"
                  >
                    <AttributeMappingTable
                      nameHeader="Name"
                      valueHeader="Maps to"
                      rows={[
                        { name: "email", value: "user's email address" },
                        { name: "givenName", value: "user's first name (optional)" },
                        { name: "familyName", value: "user's last name (optional)" },
                      ]}
                    />
                  </SetupStep>
                  <p className="mt-4 text-xs text-stone-500">
                    Finally, copy the identity provider&apos;s SAML 2.0
                    metadata document URL and paste it into Metadata URL
                    below.
                  </p>
                </ol>
              </section>
            </div>

            <div className="lg:sticky lg:top-6 lg:self-start space-y-6">
              <SamlConnectForm provider={provider} />
              <SsoDomainsCard provider={provider} />
              <SsoSignInLink provider={provider} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
