import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Plus, Trash2, Loader2 } from "lucide-react";
import { ssoConfigService } from "@/services/ssoConfigService";
import { ssoDomainService } from "@/services/ssoDomainService";
import { apiErrorMessage } from "@/api/tenantClient";
import { Spinner } from "@/components/tenant/ui";
import { Input } from "@/components/ui/input";
import type { SAMLConfig, SAMLProvider } from "@/types/tenant";

const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

interface SsoDomainsCardProps {
  provider: SAMLProvider;
}

// Lets an admin register the email domains that should auto-route to this
// SAML provider on the login page's email step (see EmailStep /
// authService.identify). Independent of the connect form's Save button —
// each add/remove is its own immediate request. Domains attach to a saved
// config, so this renders nothing until one exists (mirrors SsoSignInLink,
// which re-derives the same existing config from the same query key rather
// than depending on a prop from SamlConnectForm).
export function SsoDomainsCard({ provider }: SsoDomainsCardProps) {
  const qc = useQueryClient();
  const [domain, setDomain] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const configsQ = useQuery({
    queryKey: ["sso-configs"],
    queryFn: ssoConfigService.list,
  });
  const existing = configsQ.data?.find(
    (c): c is SAMLConfig => c.provider === provider && c.protocol === "saml",
  );

  const queryKey = ["sso-domains", existing?.id ?? ""];
  const domainsQ = useQuery({
    queryKey,
    queryFn: () => ssoDomainService.list(existing?.id ?? ""),
    enabled: Boolean(existing),
  });

  const add = useMutation({
    mutationFn: (d: string) => {
      if (!existing) throw new Error("No SAML configuration to attach a domain to.");
      return ssoDomainService.create(existing.id, d);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setDomain("");
      setFormError(null);
    },
    onError: (err: unknown) => setFormError(apiErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (domainId: string) => {
      if (!existing) throw new Error("No SAML configuration to remove a domain from.");
      return ssoDomainService.remove(existing.id, domainId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = domain.trim().toLowerCase();
    if (!trimmed || !DOMAIN_PATTERN.test(trimmed)) {
      setFormError("Enter a valid domain, e.g. contoso.com.");
      return;
    }
    setFormError(null);
    add.mutate(trimmed);
  }

  // Domains attach to a saved config -- nothing to manage until one exists.
  if (!existing) return null;

  const domains = domainsQ.data ?? [];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-stone-900">Email domains</h3>
        <p className="mt-0.5 text-xs text-stone-500">
          Users with a work email on these domains land straight on this provider from the login page&apos;s email step, without picking a workspace.
        </p>
      </div>

      {domainsQ.isLoading && <Spinner label="Loading domains…" />}

      {!domainsQ.isLoading && domains.length === 0 && (
        <p className="text-xs text-stone-400">No domains registered yet.</p>
      )}

      {domains.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {domains.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50/60 px-3 py-1.5"
            >
              <span className="flex items-center gap-1.5 font-mono text-xs text-stone-700">
                <Globe className="size-3.5 text-stone-400" />
                {d.domain}
              </span>
              <button
                type="button"
                onClick={() => remove.mutate(d.id)}
                disabled={remove.isPending}
                aria-label={`Remove domain ${d.domain}`}
                className="rounded-lg p-1 text-stone-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="contoso.com"
          aria-label="New email domain"
          aria-invalid={Boolean(formError)}
          className="h-9 flex-1 font-mono text-xs"
        />
        <button
          type="submit"
          disabled={add.isPending}
          aria-label="Add email domain"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {add.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Add
        </button>
      </form>
      {formError && <p className="mt-1.5 text-xs text-red-500">{formError}</p>}
    </div>
  );
}
