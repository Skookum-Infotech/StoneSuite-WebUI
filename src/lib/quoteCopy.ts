import type { Quote } from '@/types/quote';
import { resetCopiedFields } from './recordCopy';
import { fromQuote, quoteDefaults } from './quoteForm';

/** What a copied quote must not inherit: its number and status, the customer's
 *  PO number, dates that would be stale, and the owner. */
const QUOTE_COPY_RESET_FIELDS = [
  'quote_status', 'quote_doc_num', 'purchase_doc_num', 'quote_date', 'valid_until', 'customer_owner',
] as const;

/** The Add Quote form's starting state for "Copy quote". */
export function fromQuoteForCopy(quote: Quote): ReturnType<typeof fromQuote> {
  const mapped = fromQuote(quote);
  return { ...mapped, data: resetCopiedFields(mapped.data, quoteDefaults(), QUOTE_COPY_RESET_FIELDS) };
}
