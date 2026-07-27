// Client-side mirror of chartofaccounts.attrSchema (StoneSuite-Backend
// chartofaccounts/attributes.go) — the fixed, per-account-type attribute
// schema. This is deliberately NOT the workflow custom-fields mechanism:
// there is no workflow_field_definitions row and no per-tenant
// configurability. Keep this in sync with attributes.go by hand; the backend
// remains authoritative and always re-validates on write.
import type { AccountType } from '@/types/chartOfAccounts';

/** The one attribute encrypted at rest and never returned in full — matches
 *  chartofaccounts.BankAccountNumberKey. */
export const BANK_ACCOUNT_NUMBER_KEY = 'accountNumber';

/** Server-derived, read-only hint written alongside the ciphertext — the
 *  only part of a bank account number the API ever returns. There is no
 *  unmask affordance and no endpoint for one. */
export const ACCOUNT_NUMBER_LAST4_KEY = 'accountNumberLast4';

export interface AttrFieldDef {
  key: string;
  label: string;
  required: boolean;
  /** True only for accountNumber: never prefilled from a loaded account, and
   *  a blank value on edit means "leave unchanged" rather than "clear". */
  writeOnly: boolean;
}

interface RawAttrField {
  required?: boolean;
}

const ATTR_SCHEMA: Record<AccountType, Record<string, RawAttrField>> = {
  general: {},
  ar: {},
  ap: {},
  inventory: {},
  cash: { location: {} },
  tax: { taxRegistrationNumber: {}, jurisdiction: {} },
  fixed_asset: { assetTag: {}, usefulLifeYears: {} },
  bank: {
    bankName: { required: true },
    [BANK_ACCOUNT_NUMBER_KEY]: { required: true },
    branch: {},
    routingNumber: {},
    swift: {},
  },
  credit_card: {
    issuer: { required: true },
    last4: { required: true },
    network: {},
  },
};

const ATTR_LABELS: Record<string, string> = {
  location: 'Location',
  taxRegistrationNumber: 'Tax Registration Number',
  jurisdiction: 'Jurisdiction',
  assetTag: 'Asset Tag',
  usefulLifeYears: 'Useful Life (Years)',
  bankName: 'Bank Name',
  [BANK_ACCOUNT_NUMBER_KEY]: 'Account Number',
  branch: 'Branch',
  routingNumber: 'Routing Number',
  swift: 'SWIFT Code',
  issuer: 'Issuer',
  last4: 'Last 4 Digits',
  network: 'Network',
};

/** Attribute field definitions for one account type, in the fixed order
 *  attributes.go declares them. general/ar/ap/inventory return []. */
export function attrFieldsFor(type: AccountType): AttrFieldDef[] {
  const schema = ATTR_SCHEMA[type] ?? {};
  return Object.keys(schema).map((key) => ({
    key,
    label: ATTR_LABELS[key] ?? key,
    required: Boolean(schema[key].required),
    writeOnly: key === BANK_ACCOUNT_NUMBER_KEY,
  }));
}

/** True when `type` accepts any attributes at all. */
export function hasAttributes(type: AccountType): boolean {
  return attrFieldsFor(type).length > 0;
}

/** Client-side mirror of the required-key check ValidateAttributes runs
 *  server-side — lets the form fail fast before a round trip. Blank/whitespace
 *  counts as missing, matching the server's trim-and-treat-as-absent rule.
 *  The server is still authoritative: its 400 must be surfaced verbatim
 *  regardless of what this returns. */
export function missingRequiredAttrs(type: AccountType, attrs: Record<string, string>): string[] {
  return attrFieldsFor(type)
    .filter((f) => f.required && !(attrs[f.key] ?? '').trim())
    .map((f) => f.key);
}
