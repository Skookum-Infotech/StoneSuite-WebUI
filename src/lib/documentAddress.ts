import type { LookupItem, StateLookupItem } from '@/services/lookupService';
import { HEADER_KEYS, HEADER_LABELS, type ReviewItem } from '@/lib/salesOrderHandoffTypes';

// Pure parsing of a document's address block ("Name / Street / City, ST 12345")
// into the Sales Order form's address fields. US only (single-entity policy).

export interface ParsedAddress {
  address1: string;
  address2: string;
  city: string;
  /** Two-letter state code as printed, upper-cased; '' when not found. */
  stateCode: string;
  zip: string;
}

const CITY_STATE_ZIP = /^(.+?),?\s+([A-Za-z]{2})\.?\s+(\d{5}(?:-\d{4})?)$/;
/** "Celina 75009" - an order form's City / Zip with no state. A box, suite or
 *  unit line ("PO Box 75009", "Suite 12345") is never a city. */
const CITY_ZIP = /^(?!(?:p\.?\s*o\.?\s*)?box\b|suite\b|ste\b|unit\b|apt\b|bldg\b|building\b|floor\b|fl\b)([A-Za-z][A-Za-z .'-]*?),?\s+(\d{5}(?:-\d{4})?)$/i;
const STREET_START = /^\d/;

const normalize = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Splits an address block. A line naming the party itself (e.g. the customer)
 *  is dropped; the street (first line starting with a digit) becomes line 1 and
 *  any other lines (a site name, suite) become line 2. */
export function parseUsAddress(text: string, partyName = ''): ParsedAddress {
  const out: ParsedAddress = { address1: '', address2: '', city: '', stateCode: '', zip: '' };
  const party = normalize(partyName);
  const lines = text.split(/\r?\n|;/).map((l) => l.trim()).filter(Boolean)
    .filter((l) => !party || normalize(l) !== party);
  const lastLine = lines.length > 0 ? lines[lines.length - 1] : '';
  const last = CITY_STATE_ZIP.exec(lastLine);
  const cityZip = last ? null : CITY_ZIP.exec(lastLine);
  if (last) {
    lines.pop();
    out.city = last[1].trim();
    out.stateCode = last[2].toUpperCase();
    out.zip = last[3];
  } else if (cityZip && lines.length > 1) {
    lines.pop();
    out.city = cityZip[1].trim();
    out.zip = cityZip[2];
  }
  const streetAt = lines.findIndex((l) => STREET_START.test(l));
  const at = streetAt >= 0 ? streetAt : 0;
  out.address1 = lines[at] ?? '';
  out.address2 = lines.filter((_, i) => i !== at).join(', ');
  return out;
}

/** The lookup id (as the form's string value) of a US state code, or ''. */
export function resolveStateId(states: readonly StateLookupItem[], code: string, countryId?: number): string {
  if (!code) return '';
  const hit = states.find((s) => s.code.toUpperCase() === code && (countryId === undefined || s.countryId === countryId));
  return hit ? String(hit.id) : '';
}

const US_CODES = ['US', 'USA'];

/** Country/state lookups used to turn a printed state code into the form's id. */
export interface HandoffGeo {
  countries: readonly LookupItem[];
  states: readonly StateLookupItem[];
}
export const NO_GEO: HandoffGeo = { countries: [], states: [] };

/** Writes a parsed document address onto the form's `<prefix>_*` keys and
 *  flags a state code that isn't in the lookups. */
export function applyAddress(data: Record<string, unknown>, items: ReviewItem[], prefix: 'bill' | 'ship', text: string, partyName: string, geo: HandoffGeo): void {
  const a = parseUsAddress(text, partyName);
  data[`${prefix}_address1`] = a.address1;
  if (a.address2) data[`${prefix}_address2`] = a.address2;
  if (a.city) data[`${prefix}_city`] = a.city;
  if (a.zip) data[`${prefix}_zip`] = a.zip;
  const us = geo.countries.find((c) => US_CODES.includes(c.code.toUpperCase()));
  const stateId = resolveStateId(geo.states, a.stateCode, us?.id);
  const key = prefix === 'bill' ? HEADER_KEYS.billTo : HEADER_KEYS.shipTo;
  if (stateId) data[`${prefix}_state`] = stateId;
  else if (a.stateCode) {
    items.push({ key, label: HEADER_LABELS[key], required: false, reason: `State "${a.stateCode}" wasn't recognized - pick the state.` });
  } else if (a.city) {
    items.push({ key, label: HEADER_LABELS[key], required: false, reason: 'The document gives no state - pick the state.' });
  }
}
