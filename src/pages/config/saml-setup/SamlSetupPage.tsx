import { Fingerprint } from "lucide-react";
import { IdentityProviders } from "./components/IdentityProviders";

export default function SamlSetupPage(): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col min-h-0 bg-stone-50/60">
      <div className="bg-background border-b border-stone-200 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-brand-dark">
            <Fingerprint className="size-5" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-stone-900">
              SAML Setup
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Configure single sign-on providers and connect SAML identity
              providers for StoneSuite.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto modal-scrollbar">
        <div className="mx-auto w-full max-w-[1500px] 3xl:max-w-[1800px] 4xl:max-w-full px-6 py-4">
          <IdentityProviders />
        </div>
      </div>
    </div>
  );
}
