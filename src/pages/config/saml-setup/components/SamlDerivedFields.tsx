import { RefreshCw, Loader2 } from "lucide-react";
import { CopyField } from "./CopyField";
import type { SAMLConfig } from "@/types/tenant";

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
interface SamlDerivedFieldsProps {
  config: SAMLConfig;
  onRefresh: () => void;
  isRefreshing: boolean;
}

// Read-only fields the server derives from the IdP metadata document on
// create/update/refresh — never caller-supplied. Shared between
// SamlConnectForm (guide pages) and SamlConfigFields (Configured providers
// modal) so the two surfaces stay visually consistent.
export function SamlDerivedFields({ config, onRefresh, isRefreshing }: SamlDerivedFieldsProps) {
  return (
    <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-stone-700">Identity provider details</p>
          <p className="mt-0.5 type-helper">
            {config.metadataFetchedAt
              ? `Last fetched ${new Date(config.metadataFetchedAt).toLocaleString()}`
              : "Not fetched yet"}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh identity provider metadata"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex shrink-0')}
        >
          {isRefreshing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Refresh
        </button>
      </div>

      <CopyField label="IdP entity ID" value={config.idpEntityId || "—"} />
      <CopyField label="IdP SSO URL" value={config.ssoUrl || "—"} />
      {config.sloUrl && <CopyField label="IdP logout URL" value={config.sloUrl} />}
      <CopyField
        label="Certificate fingerprint"
        value={config.certificateFingerprint || "—"}
      />
    </div>
  );
}
