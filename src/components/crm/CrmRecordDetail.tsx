import { useQuery } from "@tanstack/react-query";
import { lookupService, type LookupItem } from "@/services/lookupService";
import {
  CRM_CORE_SECTIONS,
  CRM_CUSTOMER_BALANCE_SECTION,
  type CrmCoreField,
} from "@/lib/crmFields";
import { ModernSection, ModernFieldShell } from "./FormPrimitives";
import { checkboxLabelCls, readonlyCls } from "./formUtils";
import type { WorkspaceUser } from "@/types/tenant";

type Props = {
  coreFields: Record<string, unknown>;
  showCustomerBalances?: boolean;
  users?: WorkspaceUser[];
};

/** Read-only renderer for the unified CRM core fields, used by Lead, Prospect, and Customer detail pages. */
export function CrmRecordDetail({ coreFields, showCustomerBalances }: Props) {
  const { data: lookups } = useQuery({
    queryKey: ["crm-lookups"],
    queryFn: lookupService.getCrmLookups,
  });

  function resolveLookup(field: CrmCoreField, value: unknown): string {
    if (
      !lookups ||
      !field.lookupKey ||
      value === null ||
      value === undefined ||
      value === ""
    )
      return "";
    const items = lookups[field.lookupKey] as LookupItem[];
    const match = items.find((item) => String(item.id) === String(value));
    return match?.name ?? "";
  }

  function isFieldVisible(field: CrmCoreField): boolean {
    if (field.showIfFieldTrue)
      return Boolean(coreFields[field.showIfFieldTrue]);
    if (field.showIfFieldFalse) return !coreFields[field.showIfFieldFalse];
    return true;
  }

  function renderValue(field: CrmCoreField): string {
    const raw = coreFields[field.key];
    if (field.type === "lookup-select") return resolveLookup(field, raw);
    if (field.type === "checkbox")
      return raw === true || raw === "true" ? "Yes" : "No";
    return raw ? String(raw) : "";
  }

  function renderFieldBox(field: CrmCoreField) {
    const display = renderValue(field);

    if (field.type === "checkbox") {
      return (
        <div
          key={field.key}
          className="col-span-full flex items-center gap-3 py-2"
        >
          <div
            className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${display === "Yes" ? "bg-brand border-brand" : "bg-stone-100 border-stone-300"}`}
          >
            {display === "Yes" && (
              <svg viewBox="0 0 10 8" className="w-2.5 h-2 fill-stone-900">
                <path
                  d="M1 4l3 3 5-6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <span className={checkboxLabelCls}>{field.label}</span>
        </div>
      );
    }

    if (field.type === "address") {
      return (
        <div key={field.key} className="sm:col-span-2">
          <ModernFieldShell label={field.label}>
            <div className={`${readonlyCls} whitespace-pre-wrap`}>
              {display || <span className="text-stone-400">—</span>}
            </div>
          </ModernFieldShell>
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <div key={field.key} className="col-span-full">
          <ModernFieldShell label={field.label}>
            <div className={`${readonlyCls} whitespace-pre-wrap`}>
              {display || <span className="text-stone-400">—</span>}
            </div>
          </ModernFieldShell>
        </div>
      );
    }

    return (
      <ModernFieldShell key={field.key} label={field.label}>
        <div className={readonlyCls}>
          {display || <span className="text-stone-400">—</span>}
        </div>
      </ModernFieldShell>
    );
  }

  function renderSection(section: (typeof CRM_CORE_SECTIONS)[number], idx: number) {
    const visibleFields = section.fields.filter(isFieldVisible);
    if (visibleFields.length === 0) return null;
    return (
      <ModernSection key={section.title} title={section.title} index={idx + 1} defaultCollapsed={idx > 0}>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleFields.map(renderFieldBox)}
        </div>
      </ModernSection>
    );
  }

  return (
    <>
      {CRM_CORE_SECTIONS.map(renderSection)}

      {showCustomerBalances && (
        <ModernSection title={CRM_CUSTOMER_BALANCE_SECTION.title} index={CRM_CORE_SECTIONS.length + 1} defaultCollapsed>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {CRM_CUSTOMER_BALANCE_SECTION.fields.map(renderFieldBox)}
          </div>
        </ModernSection>
      )}
    </>
  );
}
