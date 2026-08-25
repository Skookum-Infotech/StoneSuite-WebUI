import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send, X, Loader2 } from "lucide-react";
import { portalAccessService } from "@/services/portalAccessService";
import { apiErrorMessage } from "@/api/tenantClient";
import { ErrorNote } from "@/components/tenant/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const grantSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  fullName: z.string().optional(),
});
type GrantFields = z.infer<typeof grantSchema>;

export function GrantPortalAccessModal({
  customerUuid,
  onClose,
}: {
  customerUuid: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<GrantFields>({ resolver: zodResolver(grantSchema) });

  const grant = useMutation({
    mutationFn: (data: GrantFields) =>
      portalAccessService.grant(customerUuid, {
        email: data.email,
        fullName: data.fullName ?? "",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-users", customerUuid] });
      onClose();
    },
    onError: (err) => {
      setError("root", {
        // Backend 409s with a specific message when the email already
        // belongs to a workspace user — surface it verbatim rather than a
        // generic fallback.
        message: apiErrorMessage(err, "Failed to grant portal access."),
      });
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

        <form
          onSubmit={handleSubmit((data) => grant.mutate(data))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="grant-email">
              Email address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="grant-email"
              type="email"
              placeholder="contact@customer.com"
              autoFocus
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "grant-email-error" : undefined}
              {...register("email")}
              className="h-10"
            />
            {errors.email && (
              <p id="grant-email-error" className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="grant-name">
              Full name{" "}
              <span className="text-stone-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="grant-name"
              type="text"
              placeholder="Jane Smith"
              {...register("fullName")}
              className="h-10"
            />
          </div>

          {errors.root && <ErrorNote>{errors.root.message}</ErrorNote>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
            >
              Cancel
            </button>
            <Button type="submit" disabled={isSubmitting} className="h-9 gap-2">
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              {isSubmitting ? "Granting…" : "Grant access"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
