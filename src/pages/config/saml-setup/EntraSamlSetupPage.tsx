import { Link } from "react-router-dom";
import { ShieldCheck, Info, AlertTriangle, Ban, ChevronLeft } from "lucide-react";
import { SetupStep, StepChip } from "./components/SetupStep";
import { CopyField } from "./components/CopyField";
import { AttributeMappingTable } from "./components/AttributeMappingTable";
import { SamlConnectForm } from "./components/SamlConnectForm";

const SP_ENTITY_ID = "https://app.stonesuite.io/saml/entra/metadata";
const SP_ACS_URL = "https://app.stonesuite.io/saml/entra/acs";

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
  return (
    <div className="flex flex-1 flex-col min-h-0 bg-stone-50/60">
      <div className="bg-background border-b border-stone-200 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center justify-between gap-3.5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-brand-dark">
              <ShieldCheck className="size-5" strokeWidth={2.5} />
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
          <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Preview walkthrough. The steps and StoneSuite values below are
              placeholders to shape the setup flow — they haven&apos;t been
              verified against a live Microsoft Entra ID tenant yet, and SAML
              sign-in isn&apos;t available in StoneSuite yet.
            </p>
          </div>

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
                    <CopyField
                      label="Identifier (Entity ID)"
                      value={SP_ENTITY_ID}
                    />
                    <CopyField label="Reply URL" value={SP_ACS_URL} />
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

            <div className="lg:sticky lg:top-6 lg:self-start">
              <SamlConnectForm provider="entra" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
