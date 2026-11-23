import { Banknote, ClipboardList, FileText, PackageCheck, Receipt, Truck, Undo2, Wrench, type LucideIcon } from 'lucide-react';
import type { WorkflowStageKey } from '@/types/workflow';

/** The icon each stage shows inside its marker. */
export const STAGE_ICONS: Record<WorkflowStageKey, LucideIcon> = {
  quote: FileText,
  salesOrder: ClipboardList,
  fabrication: Wrench,
  installation: Truck,
  invoice: Receipt,
  payment: Banknote,
  refund: Undo2,
  requisition: FileText,
  purchaseOrder: ClipboardList,
  receiving: PackageCheck,
  vendorBill: Receipt,
  vendorPayment: Banknote,
};
