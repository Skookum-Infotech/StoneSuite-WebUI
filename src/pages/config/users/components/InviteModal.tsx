import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send, X, Loader2, Copy, Check, MailWarning, Users } from "lucide-react";
import { userService, rbacService } from "@/services/tenantServices";
import { parseInviteError, type InviteErrorInfo } from "@/lib/inviteErrors";
import { ErrorNote } from "@/components/tenant/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  fullName: z
    .string()
    .optional()
    .refine(
      (v) => !v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      { message: "This looks like an email address — please enter a display name instead" },
    ),
  initialRoleId: z.string().optional(),
});
type InviteFields = z.infer<typeof inviteSchema>;

export function InviteModal({
  onClose,
  onViewInvites,
}: {
  onClose: () => void;
  /** Jump to the Invites list — offered when a conflict points the admin there. */
  onViewInvites?: () => void;
}) {
  const qc = useQueryClient();
  // Set only when the invite was created but the email could not be sent — the
  // admin then needs the link to share manually. A successful send closes the
  // modal straight away, as before.
  const [undeliveredLink, setUndeliveredLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // A submit rejection, sorted by parseInviteError: a 409 conflict ("already a
  // member", "already invited") is shown as information, anything else as an error.
  const [submitError, setSubmitError] = useState<InviteErrorInfo | null>(null);
  const rolesQ = useQuery({
    queryKey: ["roles"],
    queryFn: rbacService.listRoles,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InviteFields>({ resolver: zodResolver(inviteSchema) });

  const onSubmit = async (data: InviteFields) => {
    setSubmitError(null);
    try {
      const res = await userService.inviteUser({
        email: data.email,
        fullName: data.fullName || undefined,
        initialRoleId: data.initialRoleId || undefined,
      });
      qc.invalidateQueries({ queryKey: ["invites"] });
      if (res.emailSent) {
        onClose();
      } else {
        setUndeliveredLink(res.inviteLink);
      }
    } catch (err) {
      setSubmitError(parseInviteError(err, "Failed to send invitation."));
    }
  };

  const copyLink = async () => {
    if (!undeliveredLink) return;
    await navigator.clipboard.writeText(undeliveredLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Close on Escape
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
      aria-label="Invite team member"
    >
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              Invite team member
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              {undeliveredLink
                ? "The invite was created, but the email could not be sent."
                : "They'll receive an email to set up their account."}
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

        {undeliveredLink ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <MailWarning className="size-4 shrink-0" />
              <span>
                Email delivery is unavailable right now. Copy this link and send
                it to the invitee directly — it stays valid.
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-2">
              <code className="flex-1 truncate px-2 text-xs text-stone-700" title={undeliveredLink}>
                {undeliveredLink}
              </code>
              <button
                type="button"
                onClick={copyLink}
                aria-label="Copy invite link"
                className="flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-2.5 py-1.5 text-xs font-semibold text-stone-950"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={onClose} className="h-9">
                Done
              </Button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">
              Email address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
              className="h-10"
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-name">
              Full name{" "}
              <span className="text-stone-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="invite-name"
              type="text"
              placeholder="Jane Smith"
              {...register("fullName")}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-role">
              Initial role{" "}
              <span className="text-stone-400 font-normal">(optional)</span>
            </Label>
            <select
              id="invite-role"
              {...register("initialRoleId")}
              className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/50"
            >
              <option value="">No role assigned</option>
              {(rolesQ.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {submitError?.kind === "conflict" ? (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <div className="flex items-start gap-2">
                <MailWarning className="size-4 shrink-0" />
                <span>{submitError.message}</span>
              </div>
              {onViewInvites && (
                <button
                  type="button"
                  onClick={onViewInvites}
                  className="ml-6 inline-flex items-center gap-1.5 font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
                >
                  <Users className="size-3.5" />
                  View invitations
                </button>
              )}
            </div>
          ) : (
            submitError && <ErrorNote>{submitError.message}</ErrorNote>
          )}

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
              {isSubmitting ? "Sending…" : "Send invite"}
            </Button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
