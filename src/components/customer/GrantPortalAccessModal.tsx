import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, X, Loader2 } from "lucide-react";
import { portalAccessService } from "@/services/portalAccessService";
import { apiErrorMessage } from "@/api/tenantClient";
import { ErrorNote } from "@/components/tenant/ui";
import { Button } from "@/components/ui/button";

// Confirmation dialog for granting this customer a portal login. The login is
// always the customer record's own contact email (customer_contact_email,
// required at creation) — one customer, one portal login — so there is no
// email entry here, just a confirm step before the invite email goes out.
export function GrantPortalAccessModal({
  customerUuid,
  contactEmail,
  contactName,
  onClose,
}: {
  customerUuid: string;
  contactEmail: string;
  contactName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const grant = useMutation({
    mutationFn: () =>
      portalAccessService.grant(customerUuid, {
        email: contactEmail,
        fullName: contactName,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-users", customerUuid] });
      onClose();
    },
  });

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
      aria-label="Grant portal access"
    >
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              Grant portal access
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              They'll receive an email to set up their portal login.
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

        <div className="space-y-4">
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-2xs font-semibold uppercase tracking-wide text-stone-400">
              Portal login
            </p>
            <p className="mt-0.5 text-sm font-semibold text-stone-800 break-all">
              {contactEmail}
            </p>
            {contactName && (
              <p className="text-xs text-stone-500">{contactName}</p>
            )}
          </div>

          <p className="text-xs text-stone-500">
            This is the contact email on the customer record. Update the record
            first if it should go to a different address.
          </p>

          {grant.isError && (
            <ErrorNote>
              {apiErrorMessage(grant.error, "Failed to grant portal access.")}
            </ErrorNote>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
            >
              Cancel
            </button>
            <Button
              type="button"
              onClick={() => grant.mutate()}
              disabled={grant.isPending}
              className="h-9 gap-2"
            >
              {grant.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              {grant.isPending ? "Granting…" : "Grant access"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
