// Flag lookup for the Country / State dropdowns. Pure helpers only — the
// rendering lives in components/ui/Flag.tsx. Country flags come from the
// `flag-icons` package (keyed by lowercase ISO 3166-1 alpha-2); US state flags
// are static SVGs under /flags/states/{USPS code}.svg.

export type FlagKind = 'country' | 'state';

export interface OptionFlag {
  kind: FlagKind;
  code: string;
}

// An <option> carries its flag as `data-flag="country:US"` so the Select (which
// parses plain <option> children) can render it without a new child API.
export const FLAG_ATTR = 'data-flag';
const FLAG_SEPARATOR = ':';
const ALPHA2_LENGTH = 2;
const ALPHA3_LENGTH = 3;
export const STATE_FLAG_DIR = '/flags/states';

// Backends sometimes seed alpha-3 country codes (documentAddress.ts already
// accepts 'USA'); map the common ones down to alpha-2. Unknown codes simply
// render no flag.
const ALPHA3_TO_ALPHA2: Readonly<Record<string, string>> = {
  USA: 'US', CAN: 'CA', MEX: 'MX', GBR: 'GB', AUS: 'AU', NZL: 'NZ', IND: 'IN', DEU: 'DE',
  FRA: 'FR', ITA: 'IT', ESP: 'ES', PRT: 'PT', NLD: 'NL', BEL: 'BE', CHE: 'CH', AUT: 'AT',
  SWE: 'SE', NOR: 'NO', DNK: 'DK', FIN: 'FI', IRL: 'IE', POL: 'PL', CZE: 'CZ', GRC: 'GR',
  TUR: 'TR', RUS: 'RU', UKR: 'UA', CHN: 'CN', JPN: 'JP', KOR: 'KR', SGP: 'SG', MYS: 'MY',
  THA: 'TH', VNM: 'VN', PHL: 'PH', IDN: 'ID', PAK: 'PK', BGD: 'BD', LKA: 'LK', ARE: 'AE',
  SAU: 'SA', ISR: 'IL', EGY: 'EG', ZAF: 'ZA', NGA: 'NG', KEN: 'KE', BRA: 'BR', ARG: 'AR',
  CHL: 'CL', COL: 'CO', PER: 'PE', HKG: 'HK', TWN: 'TW', QAT: 'QA', KWT: 'KW', OMN: 'OM',
};

const COUNTRY_CODE_PATTERN = /^[a-z]{2}$/;
const STATE_CODE_PATTERN = /^[A-Z]{2}$/;

/** Lowercase alpha-2 for a country lookup code, or null when it can't be resolved. */
export function countryFlagCode(code: string | undefined): string | null {
  const upper = (code ?? '').trim().toUpperCase();
  const alpha2 = upper.length === ALPHA3_LENGTH ? ALPHA3_TO_ALPHA2[upper] : upper;
  const lower = (alpha2 ?? '').toLowerCase();
  return COUNTRY_CODE_PATTERN.test(lower) && lower.length === ALPHA2_LENGTH ? lower : null;
}

/** Static SVG URL for a US state / territory code, or null when malformed. */
export function stateFlagUrl(code: string | undefined): string | null {
  const upper = (code ?? '').trim().toUpperCase();
  return STATE_CODE_PATTERN.test(upper) ? `${STATE_FLAG_DIR}/${upper}.svg` : null;
}

/** `{ 'data-flag': 'country:US' }` to spread onto an <option>; empty when there's no code. */
export function flagAttrs(kind: FlagKind, code: string | undefined): Record<string, string> {
  const trimmed = (code ?? '').trim();
  return trimmed ? { [FLAG_ATTR]: `${kind}${FLAG_SEPARATOR}${trimmed}` } : {};
}

/** Maps a CrmLookups key to the flag kind its rows carry, if any. */
export function flagKindForLookup(lookupKey: string | undefined): FlagKind | null {
  if (lookupKey === 'countries') return 'country';
  if (lookupKey === 'states') return 'state';
  return null;
}

/** Same as flagAttrs, keyed by lookup name — for the generic lookupKey option loops. */
export function lookupFlagAttrs(lookupKey: string | undefined, row: { code?: string }): Record<string, string> {
  const kind = flagKindForLookup(lookupKey);
  return kind ? flagAttrs(kind, row.code) : {};
}

export function parseFlagAttr(raw: string | undefined): OptionFlag | null {
  if (!raw) return null;
  const at = raw.indexOf(FLAG_SEPARATOR);
  if (at < 0) return null;
  const kind = raw.slice(0, at);
  const code = raw.slice(at + 1);
  return (kind === 'country' || kind === 'state') && code ? { kind, code } : null;
}
