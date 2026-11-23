// Pure helpers for deriving a document form's default field values from a
// picked Customer CRM record — split out of CustomerPicker.tsx (a component
// file can only export components under react-refresh/only-export-components).

import type { CustomerRef } from '@/pages/sales/components/CustomerPicker'
import { shipSameAsBillFields } from '@/lib/shipToDefaults'

/** The Ship To section's "Is Same as Billing Customer" checkbox (quote,
 *  estimate, sales order and invoice forms all use this key). */
const SHIP_SAME_AS_BILL_KEY = 'ship_same_as_bill'

const UNNAMED_CUSTOMER = '(unnamed)'

function strOrEmpty(v: unknown): string | undefined {
  return v === null || v === undefined || v === '' ? undefined : String(v)
}

function fullName(first: unknown, last: unknown): string | undefined {
  const parts = [first, last]
    .map((v) => strOrEmpty(v)?.trim())
    .filter((v): v is string => Boolean(v))
  return parts.length > 0 ? parts.join(' ') : undefined
}

/** A customer's effective billing or shipping address: its dedicated Billing /
 *  Shipping Address block, or its primary Address when the record has
 *  "Billing/Shipping Same as Primary" checked (customer_is_bill_as_primary /
 *  customer_is_ship_as_primary) — matches what the Customer form itself
 *  treats as the customer's bill-to / ship-to address. */
function effectiveAddress(coreFields: Record<string, unknown>, target: 'bill' | 'ship') {
  if (coreFields[`customer_is_${target}_as_primary`]) {
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
  const prefix = `customer_${target}_addr_`
  return {
    line1: coreFields[`${prefix}line1`],
    line2: coreFields[`${prefix}line2`],
    suite: coreFields[`${prefix}suitenum`],
    city: coreFields[`${prefix}city`],
    state: coreFields[`${prefix}state`],
    country: coreFields[`${prefix}country`],
    zip: coreFields[`${prefix}zip`],
  }
}

/** Extracts a customer record's document-defaulting fields from its CRM
 *  coreFields — undefined when the customer record has no value set. */
export function customerCoreDefaults(coreFields: Record<string, unknown>): Pick<
  CustomerRef,
  | 'currencyId' | 'salesTaxPercent' | 'paymentTermsId' | 'priceLevelId'
  | 'billAttn' | 'billAddress1' | 'billAddress2' | 'billSuite' | 'billCity'
  | 'billStateId' | 'billCountryId' | 'billZip' | 'billPhone' | 'billFax' | 'billEmail'
  | 'shipAddress1' | 'shipAddress2' | 'shipSuite' | 'shipCity'
  | 'shipStateId' | 'shipCountryId' | 'shipZip'
> {
  const bill = effectiveAddress(coreFields, 'bill')
  const ship = effectiveAddress(coreFields, 'ship')
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
    shipAddress1: strOrEmpty(ship.line1),
    shipAddress2: strOrEmpty(ship.line2),
    shipSuite: strOrEmpty(ship.suite),
    shipCity: strOrEmpty(ship.city),
    shipStateId: strOrEmpty(ship.state),
    shipCountryId: strOrEmpty(ship.country),
    shipZip: strOrEmpty(ship.zip),
  }
}

/** Builds the CustomerRef a document form works with from a customer CRM
 *  record — the one mapping shared by CustomerPicker's search results and the
 *  useCustomerRef lookup, so a customer arriving any other way than the picker
 *  still auto-fills exactly like a picked one. */
export function customerRefFromRecord(record: { id: string; coreFields: Record<string, unknown> }): CustomerRef {
  return {
    id: record.id,
    name: String(record.coreFields.customer_name ?? UNNAMED_CUSTOMER),
    ...customerCoreDefaults(record.coreFields),
  }
}

/** Bill To form keys that always mirror the newly picked customer, even when
 *  already populated — unlike currency/tax/terms/price level below, which
 *  only ever fill a still-empty field so a manual override survives a
 *  customer swap. An address tied to the wrong customer is a correctness
 *  problem, not a preference, so re-picking always replaces it (see
 *  mergeCustomerDefaults, which every form's customer change goes through). */
export const BILL_ADDRESS_KEYS: ReadonlySet<string> = new Set([
  'bill_attn', 'bill_address1', 'bill_address2', 'bill_suite', 'bill_city',
  'bill_state', 'bill_country', 'bill_zip', 'bill_phone', 'bill_fax', 'bill_email',
])

/** Ship To form keys that always mirror the newly picked customer, for the
 *  same reason as BILL_ADDRESS_KEYS — a ship-to tied to the previous customer
 *  is wrong, not merely stale. Only forms with a Ship To section opt in (see
 *  mergeCustomerDefaults' `shipTo`). `ship_customer` is the shipping
 *  customer's name, which is the picked customer's own. */
export const SHIP_ADDRESS_KEYS: ReadonlySet<string> = new Set([
  'ship_customer', 'ship_attn', 'ship_address1', 'ship_address2', 'ship_suite',
  'ship_city', 'ship_state', 'ship_country', 'ship_zip', 'ship_phone', 'ship_fax', 'ship_email',
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

/** Maps a picked customer onto a document form's Ship To keys (`ship_*`): its
 *  own shipping address, plus its name and contact details (a customer has one
 *  contact person/phone/fax/email, shared by Bill To and Ship To). Kept apart
 *  from customerDefaultFields because only some forms have a Ship To section. */
export function customerShipToFields(customer: CustomerRef): Record<string, string> {
  const out: Record<string, string> = { ship_customer: customer.name }
  if (customer.billAttn !== undefined) out.ship_attn = customer.billAttn
  if (customer.shipAddress1 !== undefined) out.ship_address1 = customer.shipAddress1
  if (customer.shipAddress2 !== undefined) out.ship_address2 = customer.shipAddress2
  if (customer.shipSuite !== undefined) out.ship_suite = customer.shipSuite
  if (customer.shipCity !== undefined) out.ship_city = customer.shipCity
  if (customer.shipStateId !== undefined) out.ship_state = customer.shipStateId
  if (customer.shipCountryId !== undefined) out.ship_country = customer.shipCountryId
  if (customer.shipZip !== undefined) out.ship_zip = customer.shipZip
  if (customer.billPhone !== undefined) out.ship_phone = customer.billPhone
  if (customer.billFax !== undefined) out.ship_fax = customer.billFax
  if (customer.billEmail !== undefined) out.ship_email = customer.billEmail
  return out
}

/** Merges a picked customer's defaults into a document form's data: currency/
 *  tax/terms/price level only fill a still-empty field (a manual override
 *  survives a customer swap), while the Bill To — and, with `shipTo`, Ship To —
 *  address always follows the customer (see BILL_ADDRESS_KEYS). While the
 *  form's "Same as Billing" box is checked, Ship To instead re-mirrors the new
 *  Bill To, so the disabled preview never shows the previous customer's
 *  address. Returns a new object; never mutates `current`. */
export function mergeCustomerDefaults(
  current: Record<string, unknown>,
  customer: CustomerRef,
  { shipTo = false }: { shipTo?: boolean } = {},
): Record<string, unknown> {
  const mirrorsBilling = shipTo && Boolean(current[SHIP_SAME_AS_BILL_KEY])
  const defaults = customerDefaultFields(customer)
  if (shipTo && !mirrorsBilling) Object.assign(defaults, customerShipToFields(customer))

  const applied = Object.entries(defaults).filter(
    ([key]) => !current[key] || BILL_ADDRESS_KEYS.has(key) || SHIP_ADDRESS_KEYS.has(key),
  )
  const merged = { ...current, ...Object.fromEntries(applied) }
  return mirrorsBilling ? { ...merged, ...shipSameAsBillFields(merged, customer.name) } : merged
}
