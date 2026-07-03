import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send, X, Loader2 } from "lucide-react";
import { userService, rbacService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
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

export function InviteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const rolesQ = useQuery({
    queryKey: ["roles"],
    queryFn: rbacService.listRoles,
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteFields>({ resolver: zodResolver(inviteSchema) });

  const onSubmit = async (data: InviteFields) => {
    try {
      await userService.inviteUser({
        email: data.email,
        fullName: data.fullName || undefined,
        initialRoleId: data.initialRoleId || undefined,
      });
      qc.invalidateQueries({ queryKey: ["invites"] });
      onClose();
    } catch (err) {
      setError("root", {
        message: apiErrorMessage(err, "Failed to send invitation."),
      });
    }
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
              They'll receive an email to set up their account.
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
              {isSubmitting ? "Sending…" : "Send invite"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
