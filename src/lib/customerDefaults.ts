// Pure helpers for deriving a document form's default field values from a
// picked Customer CRM record — split out of CustomerPicker.tsx (a component
// file can only export components under react-refresh/only-export-components).

import type { CustomerRef } from '@/pages/sales/components/CustomerPicker'

function strOrEmpty(v: unknown): string | undefined {
  return v === null || v === undefined || v === '' ? undefined : String(v)
}

function fullName(first: unknown, last: unknown): string | undefined {
  const parts = [first, last]
    .map((v) => strOrEmpty(v)?.trim())
    .filter((v): v is string => Boolean(v))
  return parts.length > 0 ? parts.join(' ') : undefined
}

/** A customer's effective billing address: its dedicated Billing Address
 *  block, or its primary Address when the record has "Billing Same as
 *  Primary" checked (customer_is_bill_as_primary) — matches what the
 *  Customer form itself treats as the customer's bill-to address. */
function effectiveBillAddress(coreFields: Record<string, unknown>) {
  if (coreFields.customer_is_bill_as_primary) {
    return {
      line1: coreFields.customer_addr_line1,
      line2: coreFields.customer_addr_line2,
      suite: coreFields.customer_addr_suitenum,
      city: coreFields.customer_addr_city,
      state: coreFields.customer_addr_state,
      country: coreFields.customer_addr_country,
      zip: coreFields.customer_addr_zip,
    }
  }
  return {
    line1: coreFields.customer_bill_addr_line1,
    line2: coreFields.customer_bill_addr_line2,
    suite: coreFields.customer_bill_addr_suitenum,
    city: coreFields.customer_bill_addr_city,
    state: coreFields.customer_bill_addr_state,
    country: coreFields.customer_bill_addr_country,
    zip: coreFields.customer_bill_addr_zip,
  }
}

/** Extracts a customer record's document-defaulting fields from its CRM
 *  coreFields — undefined when the customer record has no value set. */
export function customerCoreDefaults(coreFields: Record<string, unknown>): Pick<
  CustomerRef,
  | 'currencyId' | 'salesTaxPercent' | 'paymentTermsId' | 'priceLevelId'
  | 'billAttn' | 'billAddress1' | 'billAddress2' | 'billSuite' | 'billCity'
  | 'billStateId' | 'billCountryId' | 'billZip' | 'billPhone' | 'billFax' | 'billEmail'
> {
  const bill = effectiveBillAddress(coreFields)
  return {
    currencyId: strOrEmpty(coreFields.customer_currency),
    salesTaxPercent: strOrEmpty(coreFields.customer_sales_tax_percent),
    paymentTermsId: strOrEmpty(coreFields.customer_payment_terms),
    priceLevelId: strOrEmpty(coreFields.customer_price_level),
    billAttn: fullName(coreFields.customer_authorized_person_fname, coreFields.customer_authorized_person_lname),
    billAddress1: strOrEmpty(bill.line1),
    billAddress2: strOrEmpty(bill.line2),
    billSuite: strOrEmpty(bill.suite),
    billCity: strOrEmpty(bill.city),
    billStateId: strOrEmpty(bill.state),
    billCountryId: strOrEmpty(bill.country),
    billZip: strOrEmpty(bill.zip),
    billPhone: strOrEmpty(coreFields.customer_primary_phonenum),
    billFax: strOrEmpty(coreFields.customer_faxnum),
    billEmail: strOrEmpty(coreFields.customer_accounts_email) ?? strOrEmpty(coreFields.customer_contact_email),
  }
}

/** Bill To form keys that always mirror the newly picked customer, even when
 *  already populated — unlike currency/tax/terms/price level below, which
 *  only ever fill a still-empty field so a manual override survives a
 *  customer swap. An address tied to the wrong customer is a correctness
 *  problem, not a preference, so re-picking always replaces it (callers
 *  filter their merge with `!current[k] || BILL_ADDRESS_KEYS.has(k)`). */
export const BILL_ADDRESS_KEYS: ReadonlySet<string> = new Set([
  'bill_attn', 'bill_address1', 'bill_address2', 'bill_suite', 'bill_city',
  'bill_state', 'bill_country', 'bill_zip', 'bill_phone', 'bill_fax', 'bill_email',
])

/** Maps a picked customer's CRM defaults onto document-form field keys
 *  (`currency_id`/`sales_tax_pct`/`payment_terms`/`price_level`/`bill_*`) —
 *  callers merge this into form state (see BILL_ADDRESS_KEYS for which keys
 *  should overwrite vs. only fill when empty). Forms that don't define one of
 *  these keys simply never read it back out. */
export function customerDefaultFields(customer: CustomerRef): Record<string, string> {
  const out: Record<string, string> = {}
  if (customer.currencyId !== undefined) out.currency_id = customer.currencyId
  if (customer.salesTaxPercent !== undefined) out.sales_tax_pct = customer.salesTaxPercent
  if (customer.paymentTermsId !== undefined) out.payment_terms = customer.paymentTermsId
  if (customer.priceLevelId !== undefined) out.price_level = customer.priceLevelId
  if (customer.billAttn !== undefined) out.bill_attn = customer.billAttn
  if (customer.billAddress1 !== undefined) out.bill_address1 = customer.billAddress1
  if (customer.billAddress2 !== undefined) out.bill_address2 = customer.billAddress2
  if (customer.billSuite !== undefined) out.bill_suite = customer.billSuite
  if (customer.billCity !== undefined) out.bill_city = customer.billCity
  if (customer.billStateId !== undefined) out.bill_state = customer.billStateId
  if (customer.billCountryId !== undefined) out.bill_country = customer.billCountryId
  if (customer.billZip !== undefined) out.bill_zip = customer.billZip
  if (customer.billPhone !== undefined) out.bill_phone = customer.billPhone
  if (customer.billFax !== undefined) out.bill_fax = customer.billFax
  if (customer.billEmail !== undefined) out.bill_email = customer.billEmail
  return out
}
