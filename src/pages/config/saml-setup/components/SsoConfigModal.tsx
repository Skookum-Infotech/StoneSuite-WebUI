import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SAML_PROVIDERS } from "@/lib/ssoConfigForm";
import type { SAMLProvider, SSOConfig, SSOProtocol, SSOProvider } from "@/types/tenant";
import { OidcConfigForm } from "./OidcConfigForm";
import { SamlConfigForm } from "./SamlConfigForm";

interface SsoConfigModalProps {
  mode: "create" | "edit";
  config: SSOConfig | null;
  availableProviders: SSOProvider[];
  onClose: () => void;
}

export function SsoConfigModal({ mode, config, availableProviders, onClose }: SsoConfigModalProps) {
  const isCreate = mode === "create";
  const availableSamlProviders = availableProviders.filter((p): p is SAMLProvider =>
    SAML_PROVIDERS.includes(p as SAMLProvider),
  );
  const hasAvailableOidc = availableProviders.length > 0;
  const hasAvailableSaml = availableSamlProviders.length > 0;

  // Edit mode is locked to the existing config's protocol. Create mode
  // defaults to whichever protocol still has an available provider (oidc
  // first, matching prior behavior when both are open).
  const [protocol, setProtocol] = useState<SSOProtocol>(
    config?.protocol ?? (hasAvailableOidc ? "oidc" : "saml"),
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={isCreate ? "Add SSO provider" : "Edit SSO provider"}
    >
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto modal-scrollbar">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              {isCreate ? "Add SSO provider" : "Edit SSO provider"}
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              {protocol === "saml"
                ? "SAML sign-in is fully wired — enabling a config lets users sign in with it."
                : "Stores connection settings only — OIDC sign-in isn't available yet."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="size-4" />
          </button>
        </div>

        {isCreate && (
          <div
            role="radiogroup"
            aria-label="SSO protocol"
            className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-stone-100 p-1"
          >
            <button
              type="button"
              role="radio"
              aria-checked={protocol === "oidc"}
              disabled={!hasAvailableOidc}
              onClick={() => setProtocol("oidc")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
                protocol === "oidc" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700",
              )}
            >
              OIDC
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={protocol === "saml"}
              disabled={!hasAvailableSaml}
              onClick={() => setProtocol("saml")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
                protocol === "saml" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700",
              )}
            >
              SAML
            </button>
          </div>
        )}

        {protocol === "saml" ? (
          <SamlConfigForm
            mode={mode}
            config={config && config.protocol === "saml" ? config : null}
            availableProviders={availableSamlProviders}
            onClose={onClose}
          />
        ) : (
          <OidcConfigForm
            mode={mode}
            config={config && config.protocol === "oidc" ? config : null}
            availableProviders={availableProviders}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
