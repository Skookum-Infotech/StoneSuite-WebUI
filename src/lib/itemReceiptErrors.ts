// Parses the 403 ErrOverReceipt response from POST /item-receipts/{uuid}/post
// (itemreceipt/tolerance.go checkTolerance) apart from an ordinary permission
// 403, and pulls the offending lines out of its message so the UI can render
// them structured rather than just echoing the sentence. Pure — no React,
// no network — so PostReceiptDialog can stay a thin consumer.
import { AxiosError } from 'axios';

// Must match itemreceipt.ErrOverReceipt.Error() exactly (store.go) — the
// controller sends `fmt.Errorf("%w: %s", ErrOverReceipt, <lines>).Error()`
// verbatim as the response message, so this is the fixed prefix before the
// per-line detail.
export const OVER_RECEIPT_MESSAGE =
  'delivery exceeds the ordered quantity beyond the accepted tolerance';

export function isOverReceiptMessage(message: string): boolean {
  return message.includes(OVER_RECEIPT_MESSAGE);
}

export interface OverReceiptLine {
  lineNumber: number;
  ordered: number;
  alreadyReceived: number;
  receiving: number;
}

// Matches `line 7 (ordered 10, already received 0, receiving 50)` as
// produced by tolerance.go's checkTolerance — Go's %g can emit exponent form
// for very large/small numbers, hence the permissive number pattern.
const LINE_PATTERN =
  /line (\d+) \(ordered ([-\d.eE+]+), already received ([-\d.eE+]+), receiving ([-\d.eE+]+)\)/g;

export function parseOverReceiptLines(message: string): OverReceiptLine[] {
  const lines: OverReceiptLine[] = [];
  for (const match of message.matchAll(LINE_PATTERN)) {
    const [, lineNumber, ordered, alreadyReceived, receiving] = match;
    lines.push({
      lineNumber: parseInt(lineNumber, 10),
      ordered: parseFloat(ordered),
      alreadyReceived: parseFloat(alreadyReceived),
      receiving: parseFloat(receiving),
    });
  }
  return lines;
}

export interface OverReceiptDetails {
  message: string;
  lines: OverReceiptLine[];
}

/** Extracts over-receipt detail from a post() rejection, or null when the
 *  error is a 403 for some other reason (e.g. a plain permission denial) or
 *  isn't a 403 at all — callers branch on that null to fall back to the
 *  generic apiErrorMessage() handling. */
export function overReceiptDetails(err: unknown): OverReceiptDetails | null {
  if (!(err instanceof AxiosError)) return null;
  if (err.response?.status !== 403) return null;
  const message = err.response?.data?.message;
  if (typeof message !== 'string' || !isOverReceiptMessage(message)) return null;
  return { message, lines: parseOverReceiptLines(message) };
}
