import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Info, AlertTriangle, ChevronLeft } from "lucide-react";
import { FaAws } from "react-icons/fa";
import { SetupStep, StepChip } from "./components/SetupStep";
import { CopyField } from "./components/CopyField";
import { AttributeMappingTable } from "./components/AttributeMappingTable";
import { SamlConnectForm } from "./components/SamlConnectForm";
import { SsoSignInLink } from "./components/SsoSignInLink";
import { samlAuthService } from "@/services/samlAuthService";
import { apiErrorMessage } from "@/api/tenantClient";
import { Spinner, ErrorNote } from "@/components/tenant/ui";

const PROVIDER = "cognito" as const;

function Callout({
  icon: Icon,
  children,
}: {
  icon: typeof Info;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-start gap-2 text-xs text-stone-500">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-stone-400" />
      {children}
    </p>
  );
}

export default function CognitoSamlSetupPage(): React.JSX.Element {
  const spInfoQ = useQuery({
    queryKey: ["saml-sp-info", PROVIDER],
    queryFn: () => samlAuthService.spInfo(PROVIDER),
  });

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-stone-50/60">
      <div className="bg-background border-b border-stone-200 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center justify-between gap-3.5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 border border-orange-100 text-[#FF9900]">
              <FaAws className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-stone-900">
                SAML Setup
              </h1>
              <p className="text-xs text-stone-500 mt-0.5">
                Connect Amazon Cognito as a SAML identity provider for StoneSuite.
              </p>
            </div>
          </div>
          <Link
            to="/config/saml-setup?tab=guides"
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
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
                <h2 className="mb-5 text-base font-bold text-stone-900">
                  Set up AWS Cognito SAML
                </h2>
                <ol>
                  <SetupStep
                    number={1}
                    title={
                      <>
                        In a new tab, sign in to the{" "}
                        <a
                          href="https://console.aws.amazon.com/cognito/"
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-stone-300 underline-offset-2 hover:text-brand-dark"
                        >
                          AWS Management Console ↗
                        </a>
                      </>
                    }
                  />
                  <SetupStep
                    number={2}
                    title={
                      <>
                        From the console, open{" "}
                        <StepChip>Amazon Cognito</StepChip> and select (or
                        create) a <StepChip>User pool</StepChip>
                      </>
                    }
                  />
                  <SetupStep
                    number={3}
                    title={
                      <>
                        Under <StepChip>Sign-in experience</StepChip>, click{" "}
                        <StepChip>Add identity provider</StepChip> and choose{" "}
                        <StepChip>SAML</StepChip>
                      </>
                    }
                  />
                  <SetupStep
                    number={4}
                    title={
                      <>
                        Enter a provider name (e.g.{" "}
                        <StepChip>StoneSuite</StepChip>) and continue
                      </>
                    }
                  />
                  <SetupStep
                    number={5}
                    isLast
                    title="Leave the metadata document/URL blank for now — you'll add StoneSuite's metadata URL in a later step"
                  >
                    <Callout icon={Info}>
                      StoneSuite requires service provider–initiated sign-in.
                    </Callout>
                  </SetupStep>
                </ol>
              </section>

              <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
                <h2 className="mb-5 text-base font-bold text-stone-900">
                  Configure AWS Cognito SAML
                </h2>
                <ol>
                  <SetupStep
                    number={6}
                    title={
                      <>
                        In your user pool, go to{" "}
                        <StepChip>App integration</StepChip> →{" "}
                        <StepChip>App clients</StepChip> and open your app
                        client
                      </>
                    }
                  />
                  <SetupStep
                    number={7}
                    title={
                      <>
                        Under <StepChip>Hosted UI</StepChip>, enable your new
                        SAML identity provider as a sign-in option
                      </>
                    }
                  />
                  <SetupStep
                    number={8}
                    title={
                      <>
                        Open the identity provider&apos;s details and click{" "}
                        <StepChip>Edit</StepChip>
                      </>
                    }
                  />
                  <SetupStep number={9} title="Set the following fields">
                    {spInfoQ.isLoading && <Spinner label="Loading StoneSuite values…" />}
                    {spInfoQ.isError && <ErrorNote>{apiErrorMessage(spInfoQ.error)}</ErrorNote>}
                    {spInfoQ.data && (
                      <>
                        <CopyField
                          label="Identifier (Entity ID)"
                          value={spInfoQ.data.spEntityId}
                        />
                        <CopyField label="Reply URL (ACS URL)" value={spInfoQ.data.acsUrl} />
                      </>
                    )}
                  </SetupStep>
                  <SetupStep
                    number={10}
                    title={
                      <>
                        Click <StepChip>Save</StepChip>
                      </>
                    }
                  />
                  <SetupStep
                    number={11}
                    title={
                      <>
                        Under <StepChip>Attribute mapping</StepChip>, click{" "}
                        <StepChip>Edit</StepChip>
                      </>
                    }
                  />
                  <SetupStep
                    number={12}
                    title="Configure the required attribute mapping"
                  >
                    <Callout icon={Info}>
                      The mapped attribute must resolve to the user&apos;s
                      unique email address.
                    </Callout>
                    <AttributeMappingTable
                      nameHeader="Cognito attribute"
                      valueHeader="SAML attribute"
                      rows={[
                        { name: "email", value: "emailaddress or equivalent" },
                      ]}
                    />
                  </SetupStep>
                  <SetupStep
                    number={13}
                    title="Delete any existing additional mappings, and add the following"
                  >
                    <Callout icon={AlertTriangle}>
                      Attribute values are case sensitive.
                    </Callout>
                    <AttributeMappingTable
                      nameHeader="Cognito attribute"
                      valueHeader="SAML attribute"
                      rows={[
                        {
                          name: "given_name",
                          value: "givenname or equivalent",
                        },
                        { name: "family_name", value: "surname or equivalent" },
                        { name: "email", value: "emailaddress or equivalent" },
                      ]}
                    />
                  </SetupStep>
                  <SetupStep
                    number={14}
                    isLast
                    title="Copy the SAML 2.0 metadata document URL from the identity provider's details, then paste it into Metadata URL below"
                  />
                </ol>
              </section>
            </div>

            <div className="lg:sticky lg:top-6 lg:self-start space-y-6">
              <SamlConnectForm provider={PROVIDER} />
              <SsoSignInLink provider={PROVIDER} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
