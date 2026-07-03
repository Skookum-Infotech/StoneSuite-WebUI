import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { X, Loader2 } from "lucide-react";
import { userService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import { ErrorNote } from "@/components/tenant/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { WorkspaceUser } from "@/types/tenant";

const editNameSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(120),
});
type EditNameFields = z.infer<typeof editNameSchema>;

export function EditNameModal({
  user,
  onClose,
}: {
  user: WorkspaceUser;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EditNameFields>({
    resolver: zodResolver(editNameSchema),
    defaultValues: { fullName: user.fullName },
  });

  const onSubmit = async (data: EditNameFields) => {
    try {
      await userService.updateUser(user.id, { fullName: data.fullName });
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    } catch (err) {
      setError("root", {
        message: apiErrorMessage(err, "Failed to update name."),
      });
    }
  };

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
      aria-label="Edit user name"
    >
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900">
            Edit display name
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100"
          >
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Full name</Label>
            <Input
              id="edit-name"
              {...register("fullName")}
              className="h-10"
              aria-invalid={Boolean(errors.fullName)}
            />
            {errors.fullName && (
              <p className="text-xs text-red-500">{errors.fullName.message}</p>
            )}
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
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
