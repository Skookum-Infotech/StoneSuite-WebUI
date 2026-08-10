import { useQuery } from "@tanstack/react-query";
import { ssoConfigService } from "@/services/ssoConfigService";
import { useAuthStore } from "@/store/useAuthStore";
import { CopyField } from "./CopyField";
import type { SAMLProvider } from "@/types/tenant";

interface SsoSignInLinkProps {
  provider: SAMLProvider;
}

// Shown once an enabled SAML config exists for this provider — a link an
// admin can hand to their users. tenant_id (already on the logged-in user,
// set at login) sidesteps needing a slug-lookup endpoint: /initiate accepts
// tenant_id as an alternative to tenant_slug.
export function SsoSignInLink({ provider }: SsoSignInLinkProps) {
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  const configsQ = useQuery({
    queryKey: ["sso-configs"],
    queryFn: ssoConfigService.list,
  });

  const config = configsQ.data?.find((c) => c.provider === provider && c.protocol === "saml");
  if (!config?.enabled || !tenantId) return null;

  const link = `${window.location.origin}/auth/login?tenant_id=${encodeURIComponent(tenantId)}&sso=${provider}`;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <h3 className="text-sm font-bold text-stone-900">Sign-in link</h3>
      <p className="mt-0.5 text-xs text-stone-500">
        Share this link with your users to let them sign in with this
        identity provider.
      </p>
      <div className="mt-3">
        <CopyField label="SSO sign-in link" value={link} />
      </div>
    </div>
  );
}
