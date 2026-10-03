import type { HandoffLine, SalesOrderHandoff } from '@/lib/salesOrderDocumentHandoff';
import type { SOLineItem } from '@/lib/salesOrderForm';
import type { CompleteExtractionInput } from '@/types/documentExtraction';

// Pure helpers for the review-mode save: what to tell /complete (it feeds the
// server's learning) and the "we'll remember" note.

/** What the user actually saved, in the shape POST /{id}/complete takes. Only
 *  lines that came from the document and ended up with a catalog item count. */
export function buildCompleteInput(
  recordUuid: string,
  form: { customerUuid: string; poNumber: string; orderDate: string },
  lines: HandoffLine[],
  lineItems: SOLineItem[],
): CompleteExtractionInput {
  const byId = new Map(lineItems.map((l) => [l.id, l]));
  return {
    recordUuid,
    saved: {
      ...form,
      lines: lines.flatMap((l) => {
        const itemUuid = byId.get(l.id)?.inventoryItemUuid;
        return itemUuid ? [{ docSku: l.docSku, docDescription: l.docDescription, itemUuid }] : [];
      }),
    },
  };
}

/** "We'll remember <doc text> -> <name> next time" when the user chose a
 *  customer other than the one the server resolved; '' otherwise. */
export function learnedCustomerNote(
  handoff: Pick<SalesOrderHandoff, 'customer'>, chosen: { id: string; name: string } | null,
): string {
  const doc = handoff.customer.extractedText.trim();
  if (!chosen || !doc) return '';
  if (handoff.customer.resolved?.id === chosen.id) return '';
  return `We'll remember ${doc} → ${chosen.name} next time.`;
}
