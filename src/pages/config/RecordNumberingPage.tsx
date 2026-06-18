import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Hash, Check, Loader2, ChevronRight } from "lucide-react";
import { workflowService, numberingService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import { Spinner, ErrorNote } from "@/components/tenant/ui";
import { cn } from "@/lib/utils";
import type { Workflow } from "@/types/tenant";

// ---------------------------------------------------------------------------

const numberingSchema = z.object({
  enabled: z.boolean(),
  prefix: z.string().max(20, "Max 20 chars"),
  suffix: z.string().max(20, "Max 20 chars"),
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

  const workflows = workflowsQ.data ?? [];

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-stone-50/60">
      {/* Page header */}
      <div className="bg-background border-b border-stone-200 px-6 py-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-brand-dark">
            <Hash className="size-5" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-stone-900">
              Record Numbering
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Auto-generate sequential IDs like{" "}
              <code className="font-mono bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded-md text-2xs">
                LEAD-0001
              </code>{" "}
              for each workflow.
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        {workflowsQ.isLoading && (
          <div className="flex items-center justify-center h-40">
            <Spinner label="Loading workflows…" />
          </div>
        )}
        {workflowsQ.isError && (
          <div className="max-w-lg">
            <ErrorNote>{apiErrorMessage(workflowsQ.error)}</ErrorNote>
          </div>
        )}
        {!workflowsQ.isLoading &&
          workflows.length === 0 &&
          !workflowsQ.isError && (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Hash className="size-8 text-stone-300 mb-2" />
              <p className="text-sm text-stone-400">No workflows found.</p>
            </div>
          )}
        {workflows.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
            {/* Table header */}
            <div
              className="grid items-center px-5 py-3 bg-stone-50 border-b border-stone-200 gap-3 text-2xs font-bold uppercase tracking-widest text-stone-400 select-none"
              style={{
                gridTemplateColumns:
                  "minmax(120px,1.2fr) 72px minmax(100px,1fr) minmax(100px,1fr) 90px 106px minmax(140px,1.4fr) 88px",
              }}
            >
              <span>Workflow</span>
              <span className="text-center">Active</span>
              <span>Prefix</span>
              <span>Suffix</span>
              <span>Digits</span>
              <span>Next #</span>
              <span>Preview</span>
              <span />
            </div>

            {/* Workflow rows */}
            {workflows.map((wf, idx) => (
              <WorkflowRow
                key={wf.id}
                workflow={wf}
                isLast={idx === workflows.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function WorkflowRow({
  workflow,
  isLast,
}: {
  workflow: Workflow;
  isLast: boolean;
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
      setTimeout(() => setSaveSuccess(false), 2500);
    },
    onError: (err: unknown) => {
      setGeneralError(apiErrorMessage(err));
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

  const preview = enabled
    ? `${prefix}${String(nextNumber).padStart(minDigits, "0")}${suffix}`
    : null;
  const previewNext = enabled
    ? `${prefix}${String(nextNumber + 1).padStart(minDigits, "0")}${suffix}`
    : null;

  const cellInput = (hasError: boolean, disabled: boolean) =>
    cn(
      "w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-xs font-mono text-stone-800",
      "placeholder:text-stone-300 transition-colors focus:outline-none",
      hasError
        ? "border-red-300 bg-red-50/60 focus:border-red-400 focus:ring-1 focus:ring-red-200"
        : disabled
          ? "border-transparent text-stone-400 cursor-default"
          : "border-stone-200 hover:border-stone-300 focus:border-brand focus:ring-1 focus:ring-brand/25",
    );

  const rowBase = cn(
    "grid items-center px-5 py-3 gap-3 transition-colors",
    !isLast && "border-b border-stone-100",
    saveSuccess ? "bg-emerald-50/40" : "hover:bg-stone-50/70",
  );

  if (configQ.isLoading) {
    return (
      <div
        className={cn(rowBase, "flex items-center justify-start")}
        style={{ gridTemplateColumns: "unset", display: "flex" }}
      >
        <div className="flex items-center gap-2.5 text-xs text-stone-400 py-1">
          <Loader2 className="size-3.5 animate-spin" />
          <span className="font-semibold">{workflow.name}</span>
          <span className="text-stone-300">—</span>
          <span>Loading config…</span>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={rowBase}
      style={{
        gridTemplateColumns:
          "minmax(120px,1.2fr) 72px minmax(100px,1fr) minmax(100px,1fr) 90px 106px minmax(140px,1.4fr) 88px",
      }}
    >
      {/* Workflow name + key */}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-stone-800 truncate">
          {workflow.name}
        </p>
        <p className="font-mono text-2xs text-stone-400 mt-0.5 truncate">
          {workflow.key}
        </p>
      </div>

      {/* Toggle */}
      <div className="flex justify-center">
        <label
          className="cursor-pointer"
          aria-label={`Toggle auto-numbering for ${workflow.name}`}
        >
          <input type="checkbox" className="sr-only" {...register("enabled")} />
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

      {/* Prefix */}
      <div>
        <input
          type="text"
          placeholder={enabled ? "e.g. LEAD-" : "—"}
          {...register("prefix")}
          disabled={!enabled}
          className={cellInput(Boolean(errors.prefix), !enabled)}
        />
        {errors.prefix && (
          <p className="mt-0.5 px-1 text-2xs text-red-500">
            {errors.prefix.message}
          </p>
        )}
      </div>

      {/* Suffix */}
      <div>
        <input
          type="text"
          placeholder={enabled ? "Optional" : "—"}
          {...register("suffix")}
          disabled={!enabled}
          className={cellInput(Boolean(errors.suffix), !enabled)}
        />
        {errors.suffix && (
          <p className="mt-0.5 px-1 text-2xs text-red-500">
            {errors.suffix.message}
          </p>
        )}
      </div>

      {/* Min digits */}
      <div>
        <input
          type="number"
          min={1}
          max={10}
          {...register("minDigits")}
          disabled={!enabled}
          className={cn(
            cellInput(Boolean(errors.minDigits), !enabled),
            "text-center",
          )}
        />
        {errors.minDigits && (
          <p className="mt-0.5 px-1 text-2xs text-red-500">
            {errors.minDigits.message}
          </p>
        )}
      </div>

      {/* Next number */}
      <div>
        <input
          type="number"
          min={1}
          {...register("nextNumber")}
          disabled={!enabled}
          className={cn(
            cellInput(Boolean(errors.nextNumber), !enabled),
            "text-right",
          )}
        />
        {errors.nextNumber && (
          <p className="mt-0.5 px-1 text-2xs text-red-500">
            {errors.nextNumber.message}
          </p>
        )}
      </div>

      {/* Live preview */}
      <div className="min-w-0">
        {preview ? (
          <div className="flex items-center gap-1 min-w-0">
            <span className="font-mono text-xs font-bold text-brand-dark bg-brand/8 rounded-md px-2 py-0.5 truncate shrink-0 max-w-[100px]">
              {preview}
            </span>
            <ChevronRight className="size-3 text-stone-300 shrink-0" />
            <span className="font-mono text-2xs text-stone-400 truncate">
              {previewNext}
            </span>
          </div>
        ) : (
          <span className="text-2xs text-stone-300 italic">—</span>
        )}
      </div>

      {/* Save / feedback */}
      <div className="flex items-center justify-end gap-2 min-w-0">
        {generalError && (
          <span className="text-2xs text-red-500 truncate" title={generalError}>
            Error
          </span>
        )}
        <button
          type="submit"
          disabled={isSubmitting || save.isPending || !enabled}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shrink-0",
            saveSuccess
              ? "bg-emerald-500 text-white shadow-sm"
              : !enabled
                ? "bg-stone-100 text-stone-400 cursor-not-allowed"
                : "bg-brand text-stone-950 shadow-sm hover:bg-brand/80 disabled:opacity-60",
          )}
        >
          {save.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : saveSuccess ? (
            <>
              <Check className="size-3" />
              Saved
            </>
          ) : (
            "Save"
          )}
        </button>
      </div>
    </form>
  );
}
