import { useWatch } from "react-hook-form";
import type { Control, FieldValues, Path, UseFormRegister } from "react-hook-form";
import { cn } from "@/lib/utils";

// Shared enabled-toggle switch, generic over the enclosing form's value type
// so OidcConfigForm, SamlConfigForm, and SamlConnectForm (three differently
// -typed useForm instances) can all reuse it without a wrapper per form.
export function EnabledToggle<T extends FieldValues>({
  register,
  control,
  watchName,
  hint,
}: {
  register: UseFormRegister<T>;
  control: Control<T>;
  watchName: Path<T>;
  hint: string;
}) {
  const enabled = Boolean(useWatch({ control, name: watchName }));
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2.5">
      <div>
        <p className="text-xs font-semibold text-stone-700">Enabled</p>
        <p className="mt-0.5 text-2xs text-stone-400">{hint}</p>
      </div>
      <label className="cursor-pointer shrink-0" aria-label="Toggle SSO provider enabled">
        <input type="checkbox" className="sr-only" {...register(watchName)} />
        <div
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors duration-200",
            enabled ? "bg-brand" : "bg-stone-200",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
              enabled ? "left-[18px]" : "left-0.5",
            )}
          />
        </div>
      </label>
    </div>
  );
}
