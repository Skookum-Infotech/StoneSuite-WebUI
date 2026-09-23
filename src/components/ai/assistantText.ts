import { recordRoute } from '@/lib/recentRecordRoute';
import type { Citation } from '@/types/ai';

/** The backend's question limit — in UTF-8 bytes, not characters, so it is
 *  checked the same way here: an accented or CJK question hits it sooner
 *  than its character count suggests. */
export const MAX_QUESTION_BYTES = 2000;

const encoder = new TextEncoder();
export function questionBytes(text: string): number {
  return encoder.encode(text).length;
}

/** The detail-page route for a record citation, or null when it can't be
 *  linked (a help citation, or a record without a known type or id). Built
 *  from the citation's own record_type — never from the page the user is on,
 *  which would send a lead cited from a prospect page to /crm/prospect/<leadId>. */
export function citationRoute(citation: Citation): string | null {
  if (citation.source_type !== 'record' || !citation.record_type || !citation.source_id) return null;
  return recordRoute('crm', citation.record_type, citation.source_id);
}

export const CITE_PREFIX = '#cite-';
/** Longest range a single marker may expand to ("[1-3]"); a hallucinated
 *  "[1-9999]" renders as its first few numbers, not thousands of links. */
const MAX_MARKER_RANGE = 10;

// Same marker shapes the backend recognizes when deciding which sources an
// answer cited: [1], [1, 2], [1-3], [1–3].
const markerRe = /\[(\d+(?:\s*[,\-\u2013]\s*\d+)*)\](?!\()/g;

function markerNumbers(inner: string): number[] {
  const out: number[] = [];
  for (const part of inner.split(',')) {
    const [lo, hi] = part.replace('\u2013', '-').split('-').map((p) => Number.parseInt(p.trim(), 10));
    if (Number.isNaN(lo)) continue;
    const end = Number.isNaN(hi ?? Number.NaN) ? lo : Math.min(hi, lo + MAX_MARKER_RANGE - 1);
    for (let n = lo; n <= end; n++) out.push(n);
  }
  return out;
}

/** Rewrites [n] markers as links to "#cite-n" so the markdown renderer can
 *  turn them into citation buttons. */
export function linkCitationMarkers(text: string): string {
  return text.replace(markerRe, (_, inner: string) =>
    markerNumbers(inner).map((n) => `[${n}](${CITE_PREFIX}${n})`).join(''),
  );
}
