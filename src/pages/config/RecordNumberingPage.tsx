import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Hash, Check } from "lucide-react";
import { workflowService, numberingService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import { Spinner, ErrorNote } from "@/components/tenant/ui";
import { cn } from "@/lib/utils";
import type { Workflow } from "@/types/tenant";

// ---------------------------------------------------------------------------

const numberingSchema = z.object({
  enabled: z.boolean(),
  prefix: z.string().max(20, "Max 20 characters"),
  suffix: z.string().max(20, "Max 20 characters"),
  minDigits: z.coerce.number().int().min(1, "Min 1").max(10, "Max 10"),
  nextNumber: z.coerce.number().int().min(1, "Must be ≥ 1"),
});

type NumberingFormValues = z.infer<typeof numberingSchema>;

// ---------------------------------------------------------------------------

export default function RecordNumberingPage(): React.JSX.Element {
  const workflowsQ = useQuery({
    queryKey: ["workflows"],
    queryFn: workflowService.list,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const workflows = workflowsQ.data ?? [];
  const activeId = selectedId ?? workflows[0]?.id ?? null;
  const activeWorkflow = workflows.find((w) => w.id === activeId) ?? null;

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-white">
      {/* Page header */}
      <div className="flex items-center gap-3 border-b border-stone-100 px-6 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
          <Hash className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Record Numbering
          </h1>
          <p className="text-sm text-stone-500">
            Auto-generate sequential numbers (e.g. LEAD-0001) for new records
            per workflow.
          </p>
        </div>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel: workflow list */}
        <aside className="flex flex-col w-60 shrink-0 border-r border-stone-100">
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {workflowsQ.isLoading && (
              <p className="px-2 py-4 text-xs text-stone-400">Loading…</p>
            )}
            {workflowsQ.isError && (
              <p className="px-2 py-2 text-xs text-red-500">
                {apiErrorMessage(workflowsQ.error)}
              </p>
            )}
            {workflows.map((wf) => {
              const active = wf.id === activeId;
              return (
                <button
                  key={wf.id}
                  type="button"
                  onClick={() => setSelectedId(wf.id)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2.5 text-left transition-colors border",
                    active
                      ? "bg-brand/10 border-brand/25"
                      : "border-transparent hover:bg-stone-50",
                  )}
                >
                  <span
                    className={cn(
                      "block text-xs font-semibold",
                      active ? "text-brand-dark" : "text-stone-700",
                    )}
                  >
                    {wf.name}
                  </span>
                  <span className="block mt-0.5 font-mono text-2xs text-stone-400">
                    {wf.key}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right panel */}
        <main className="flex-1 overflow-y-auto">
          {!activeWorkflow && !workflowsQ.isLoading && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Hash className="mx-auto mb-2 size-8 text-stone-300" />
                <p className="text-sm text-stone-400">
                  Select a workflow to configure record numbering.
                </p>
              </div>
            </div>
          )}
          {activeWorkflow && <NumberingPanel workflow={activeWorkflow} />}
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function NumberingPanel({
  workflow,
}: {
  workflow: Workflow;
}): React.JSX.Element {
  const qc = useQueryClient();

  const configQ = useQuery({
    queryKey: ["workflow-numbering", workflow.id],
    queryFn: () => numberingService.get(workflow.id),
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NumberingFormValues>({
    resolver: zodResolver(
      numberingSchema,
    ) as unknown as Resolver<NumberingFormValues>,
    defaultValues: {
      enabled: false,
      prefix: "",
      suffix: "",
      minDigits: 4,
      nextNumber: 1,
    },
  });

  useEffect(() => {
    if (configQ.data) {
      reset({
        enabled: configQ.data.enabled,
        prefix: configQ.data.prefix,
        suffix: configQ.data.suffix,
        minDigits: configQ.data.minDigits,
        nextNumber: configQ.data.nextNumber,
      });
    }
  }, [configQ.data, reset]);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (data: NumberingFormValues) =>
      numberingService.update(workflow.id, {
        enabled: data.enabled,
        prefix: data.prefix,
        suffix: data.suffix,
        minDigits: Number(data.minDigits),
        nextNumber: Number(data.nextNumber),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow-numbering", workflow.id] });
      setSaveSuccess(true);
      setGeneralError(null);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err: unknown) => {
      const asAxios = err as {
        response?: {
          data?: { errors?: Array<{ field: string; message: string }> };
        };
      };
      const apiValidationErrors = asAxios?.response?.data?.errors;
      if (apiValidationErrors?.length) {
        let hadFieldMatch = false;
        for (const ve of apiValidationErrors) {
          const field = ve.field as keyof NumberingFormValues;
          if (
            ["enabled", "prefix", "suffix", "minDigits", "nextNumber"].includes(
              field,
            )
          ) {
            setError(field, { message: ve.message });
            hadFieldMatch = true;
          }
        }
        if (!hadFieldMatch) setGeneralError(apiErrorMessage(err));
      } else {
        setGeneralError(apiErrorMessage(err));
      }
    },
  });

  function onSubmit(data: NumberingFormValues) {
    setSaveSuccess(false);
    setGeneralError(null);
    save.mutate(data);
  }

  const watched = useWatch({ control });
  const enabled = Boolean(watched.enabled);
  const prefix = watched.prefix ?? "";
  const suffix = watched.suffix ?? "";
  const minDigits = Math.max(1, Number(watched.minDigits) || 4);
  const nextNumber = Math.max(1, Number(watched.nextNumber) || 1);

  const previewFirst = enabled
    ? `${prefix}${String(nextNumber).padStart(minDigits, "0")}${suffix}`
    : null;
  const previewSecond = enabled
    ? `${prefix}${String(nextNumber + 1).padStart(minDigits, "0")}${suffix}`
    : null;

  if (configQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Spinner label="Loading config…" />
      </div>
    );
  }

  if (configQ.isError) {
    return (
      <div className="p-6">
        <ErrorNote>{apiErrorMessage(configQ.error)}</ErrorNote>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col min-h-full"
    >
      {/* Panel header */}
      <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-6 pt-6 pb-4">
        <div>
          <h2 className="text-base font-bold text-stone-900">
            {workflow.name}
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Configure auto-numbering for{" "}
            <span className="font-mono">{workflow.key}</span> records.
          </p>
        </div>
      </div>

      <div className="px-6 pt-5 space-y-6 pb-8">
        {/* Enable toggle */}
        <div className="flex items-center justify-between rounded-xl border border-stone-200 px-4 py-3.5">
          <div>
            <p className="text-sm font-semibold text-stone-800">
              Enable auto-numbering
            </p>
            <p className="text-xs text-stone-500 mt-0.5">
              Assign a sequential number to every new record in this workflow.
            </p>
          </div>
          <label
            className="inline-flex cursor-pointer items-center gap-2"
            aria-label="Enable auto-numbering"
          >
            <input
              type="checkbox"
              className="sr-only"
              {...register("enabled")}
            />
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

        {/* Config grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Prefix */}
          <div>
            <label
              htmlFor={`prefix-${workflow.id}`}
              className="block mb-1.5 text-xs font-semibold text-stone-700"
            >
              Prefix
            </label>
            <input
              id={`prefix-${workflow.id}`}
              type="text"
              placeholder="e.g. LEAD-"
              {...register("prefix")}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400",
                "focus:outline-none focus:ring-2 focus:ring-brand/40",
                errors.prefix
                  ? "border-red-400 focus:border-red-400"
                  : "border-stone-200 focus:border-brand",
              )}
            />
            {errors.prefix ? (
              <p className="mt-1 text-2xs text-red-500">
                {errors.prefix.message}
              </p>
            ) : (
              <p className="mt-1 text-2xs text-stone-400">
                Up to 20 characters
              </p>
            )}
          </div>

          {/* Suffix */}
          <div>
            <label
              htmlFor={`suffix-${workflow.id}`}
              className="block mb-1.5 text-xs font-semibold text-stone-700"
            >
              Suffix
            </label>
            <input
              id={`suffix-${workflow.id}`}
              type="text"
              placeholder="Optional"
              {...register("suffix")}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400",
                "focus:outline-none focus:ring-2 focus:ring-brand/40",
                errors.suffix
                  ? "border-red-400 focus:border-red-400"
                  : "border-stone-200 focus:border-brand",
              )}
            />
            {errors.suffix ? (
              <p className="mt-1 text-2xs text-red-500">
                {errors.suffix.message}
              </p>
            ) : (
              <p className="mt-1 text-2xs text-stone-400">
                Up to 20 characters
              </p>
            )}
          </div>

          {/* Min digits */}
          <div>
            <label
              htmlFor={`minDigits-${workflow.id}`}
              className="block mb-1.5 text-xs font-semibold text-stone-700"
            >
              Minimum digits
            </label>
            <input
              id={`minDigits-${workflow.id}`}
              type="number"
              min={1}
              max={10}
              {...register("minDigits")}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm text-stone-800",
                "focus:outline-none focus:ring-2 focus:ring-brand/40",
                errors.minDigits
                  ? "border-red-400 focus:border-red-400"
                  : "border-stone-200 focus:border-brand",
              )}
            />
            {errors.minDigits ? (
              <p className="mt-1 text-2xs text-red-500">
                {errors.minDigits.message}
              </p>
            ) : (
              <p className="mt-1 text-2xs text-stone-400">
                1–10 (zero-pad width)
              </p>
            )}
          </div>

          {/* Next number */}
          <div>
            <label
              htmlFor={`nextNumber-${workflow.id}`}
              className="block mb-1.5 text-xs font-semibold text-stone-700"
            >
              Next number
            </label>
            <input
              id={`nextNumber-${workflow.id}`}
              type="number"
              min={1}
              {...register("nextNumber")}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm text-stone-800",
                "focus:outline-none focus:ring-2 focus:ring-brand/40",
                errors.nextNumber
                  ? "border-red-400 focus:border-red-400"
                  : "border-stone-200 focus:border-brand",
              )}
            />
            {errors.nextNumber ? (
              <p className="mt-1 text-2xs text-red-500">
                {errors.nextNumber.message}
              </p>
            ) : (
              <p className="mt-1 text-2xs text-stone-400">
                Increasing it skips numbers — cannot be reversed below the
                highest issued.
              </p>
            )}
          </div>
        </div>

        {/* Preview */}
        {previewFirst && (
          <div className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3.5">
            <p className="mb-2 text-2xs font-bold uppercase tracking-widest text-stone-500">
              Preview
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-base font-bold text-brand-dark">
                {previewFirst}
              </span>
              <span className="text-stone-300">→</span>
              <span className="font-mono text-sm text-stone-400">
                {previewSecond}
              </span>
              <span className="text-stone-300">→ …</span>
            </div>
            <p className="mt-1.5 text-2xs text-stone-500">
              The next record created in this workflow will receive{" "}
              <span className="font-mono font-semibold">{previewFirst}</span>,
              then{" "}
              <span className="font-mono font-semibold">{previewSecond}</span>,
              and so on.
            </p>
          </div>
        )}

        {/* Feedback */}
        {generalError && <ErrorNote>{generalError}</ErrorNote>}
        {saveSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700">
            <Check className="size-3.5" />
            Numbering configuration saved.
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || save.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2 text-xs font-semibold text-stone-950 shadow-sm transition hover:bg-brand/70 disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save configuration"}
          </button>
        </div>
      </div>
    </form>
  );
}
