import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Info, AlertTriangle, Ban, ChevronLeft } from "lucide-react";
import { MicrosoftLogo } from "@/components/icons/MicrosoftLogo";
import { SetupStep, StepChip } from "./components/SetupStep";
import { CopyField } from "./components/CopyField";
import { AttributeMappingTable } from "./components/AttributeMappingTable";
import { SamlConnectForm } from "./components/SamlConnectForm";
import { SsoSignInLink } from "./components/SsoSignInLink";
import { samlAuthService } from "@/services/samlAuthService";
import { apiErrorMessage } from "@/api/tenantClient";
import { Spinner, ErrorNote } from "@/components/tenant/ui";

const PROVIDER = "entra" as const;

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

export default function EntraSamlSetupPage(): React.JSX.Element {
  const spInfoQ = useQuery({
    queryKey: ["saml-sp-info", PROVIDER],
    queryFn: () => samlAuthService.spInfo(PROVIDER),
  });

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-stone-50/60">
      <div className="bg-background border-b border-stone-200 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center justify-between gap-3.5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-50 border border-stone-200">
              <MicrosoftLogo className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-stone-900">
                SAML Setup
              </h1>
              <p className="text-xs text-stone-500 mt-0.5">
                Connect Microsoft Entra ID as a SAML identity provider for
                StoneSuite.
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
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
                <h2 className="mb-5 text-base font-bold text-stone-900">
                  Set up Microsoft Entra ID SAML
                </h2>
                <ol>
                  <SetupStep
                    number={1}
                    title={
                      <>
                        In a new tab, sign in to{" "}
                        <a
                          href="https://entra.microsoft.com/"
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-stone-300 underline-offset-2 hover:text-brand-dark"
                        >
                          Microsoft Entra ID ↗
                        </a>
                      </>
                    }
                  />
                  <SetupStep
                    number={2}
                    title={
                      <>
                        From the dashboard menu, go to{" "}
                        <StepChip>Applications</StepChip> →{" "}
                        <StepChip>Enterprise applications</StepChip>
                      </>
                    }
                  />
                  <SetupStep
                    number={3}
                    title={
                      <>
                        Click <StepChip>New application</StepChip>, then{" "}
                        <StepChip>Create your own application</StepChip>
                      </>
                    }
                  />
                  <SetupStep
                    number={4}
                    title={
                      <>
                        Enter an app name (e.g.{" "}
                        <StepChip>StoneSuite</StepChip>) and select{" "}
                        <StepChip>
                          Integrate any other application you don&apos;t find
                          in the gallery (Non-gallery)
                        </StepChip>
                      </>
                    }
                  />
                  <SetupStep
                    number={5}
                    isLast
                    title={
                      <>
                        Switch to the <StepChip>Properties</StepChip> tab and
                        toggle off <StepChip>Visible to users</StepChip>
                      </>
                    }
                  >
                    <Callout icon={Info}>
                      StoneSuite does not support identity provider-initiated
                      flows.
                    </Callout>
                  </SetupStep>
                </ol>
              </section>

              <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
                <h2 className="mb-5 text-base font-bold text-stone-900">
                  Configure Microsoft Entra ID SAML
                </h2>
                <ol>
                  <SetupStep
                    number={6}
                    title={
                      <>
                        Switch to the <StepChip>Overview</StepChip> tab
                      </>
                    }
                  />
                  <SetupStep
                    number={7}
                    title={
                      <>
                        Click <StepChip>Set up single sign-on</StepChip> and
                        select <StepChip>SAML</StepChip>
                      </>
                    }
                  />
                  <SetupStep
                    number={8}
                    title={
                      <>
                        Under <StepChip>Basic SAML configuration</StepChip>,
                        click <StepChip>Edit</StepChip>
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
                        <CopyField label="Reply URL" value={spInfoQ.data.acsUrl} />
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
                        Under <StepChip>Attributes &amp; claims</StepChip>,
                        click <StepChip>Edit</StepChip>
                      </>
                    }
                  />
                  <SetupStep
                    number={12}
                    title={
                      <>
                        Configure the <StepChip>Required claim</StepChip>{" "}
                        section as follows
                      </>
                    }
                  >
                    <Callout icon={Info}>
                      The attribute value must be the user&apos;s unique email
                      address. This section does not need to be changed from
                      the default in most cases, but may require
                      customization depending on how your Entra ID instance
                      has been configured.
                    </Callout>
                    <AttributeMappingTable
                      nameHeader="Name"
                      valueHeader="Microsoft Entra ID attribute"
                      rows={[
                        {
                          name: "Unique User Identifier (Name ID)",
                          value:
                            "user.userprincipalname, user.mail or equivalent",
                        },
                      ]}
                    />
                  </SetupStep>
                  <SetupStep
                    number={13}
                    title="Delete any existing additional claims, and add the following claims"
                  >
                    <Callout icon={AlertTriangle}>
                      Attribute values are case sensitive.
                    </Callout>
                    <Callout icon={Ban}>
                      Leave the field namespace empty for each claim.
                    </Callout>
                    <AttributeMappingTable
                      nameHeader="Name"
                      valueHeader="Microsoft Entra ID attribute"
                      rows={[
                        {
                          name: "givenName",
                          value: "user.givenname or equivalent",
                        },
                        {
                          name: "familyName",
                          value: "user.surname or equivalent",
                        },
                        { name: "email", value: "user.mail or equivalent" },
                      ]}
                    />
                  </SetupStep>
                  <SetupStep
                    number={14}
                    isLast
                    title="Under SAML Certificate, copy the App Federation Metadata URL, then paste it into Metadata URL below"
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
