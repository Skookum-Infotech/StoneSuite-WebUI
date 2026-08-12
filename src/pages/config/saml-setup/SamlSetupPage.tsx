import { useSearchParams } from "react-router-dom";
import { Fingerprint } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfiguredProvidersTab } from "./components/ConfiguredProvidersTab";
import { SetupGuidesTab } from "./components/SetupGuidesTab";

const TABS = [
  { key: "configured", label: "Configured providers" },
  { key: "guides", label: "Setup guides" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function SamlSetupPage(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab: TabKey = requestedTab === "guides" ? "guides" : "configured";

  function selectTab(key: TabKey) {
    setSearchParams(key === "configured" ? {} : { tab: key });
  }

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

      <div role="tablist" aria-label="SAML Setup" className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-4 sm:px-6 modal-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`saml-setup-tab-${tab.key}`}
            aria-selected={activeTab === tab.key}
            aria-controls={`saml-setup-tabpanel-${tab.key}`}
            onClick={() => selectTab(tab.key)}
            className={cn(
              "px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors duration-150 whitespace-nowrap shrink-0",
              activeTab === tab.key
                ? "border-brand text-stone-950"
                : "border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-200",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto modal-scrollbar">
        <div className="mx-auto w-full max-w-[1500px] 3xl:max-w-[1800px] 4xl:max-w-full px-6 py-4">
          <div
            role="tabpanel"
            id="saml-setup-tabpanel-configured"
            aria-labelledby="saml-setup-tab-configured"
            hidden={activeTab !== "configured"}
          >
            {activeTab === "configured" && <ConfiguredProvidersTab />}
          </div>
          <div
            role="tabpanel"
            id="saml-setup-tabpanel-guides"
            aria-labelledby="saml-setup-tab-guides"
            hidden={activeTab !== "guides"}
          >
            {activeTab === "guides" && <SetupGuidesTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
