import type { WidgetCategory } from "@/types/dashboardWidgets";

export type WidgetPresetId = "essentials" | "sales-pack" | "ops-pack" | "finance-pack" | "everything";

export interface WidgetPreset {
  id: WidgetPresetId;
  label: string;
  // 'all' means every widget in the catalog, regardless of category.
  categories: WidgetCategory[] | "all";
}

// Fixed, non-editable presets derived from WIDGET_CATALOG's existing
// category field (src/config/dashboardWidgets.ts) — each pack layers a
// category on top of core so a role never loses the essentials.
export const WIDGET_PRESETS: WidgetPreset[] = [
  { id: "essentials", label: "Essentials", categories: ["core"] },
  { id: "sales-pack", label: "Sales pack", categories: ["core", "sales"] },
  { id: "ops-pack", label: "Ops pack", categories: ["core", "operations"] },
  { id: "finance-pack", label: "Finance pack", categories: ["core", "finance"] },
  { id: "everything", label: "Everything", categories: "all" },
];
