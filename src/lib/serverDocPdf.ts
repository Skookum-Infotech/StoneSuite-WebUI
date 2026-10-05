import { toast } from "sonner";
import { tenantClient } from "@/api/tenantClient";
import { buildExportFilename, type SalesDocType } from "@/lib/salesPdfExport";

/** Document types the backend renders itself (docpdf), with the record's real
 *  Terms & Conditions, Notes and the tenant's Payment Details. */
export type ServerPdfDocType = Extract<SalesDocType, "invoice" | "quote" | "estimate" | "sales_order">;

/** Downloads the server-rendered PDF for a record. Unlike the client-side
 *  summary export it prints the document's real terms and payment details. */
export async function downloadServerDocPdf(params: {
  recordId: string;
  docType: ServerPdfDocType;
  recordNumber: string | undefined;
}): Promise<void> {
  const { data } = await tenantClient.get<Blob>(`/tenant/records/${encodeURIComponent(params.recordId)}/document/pdf`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = buildExportFilename(params.docType, params.recordNumber, params.docType);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success("Downloaded successfully!");
}
