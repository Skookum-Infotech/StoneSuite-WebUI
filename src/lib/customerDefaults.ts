// Pure helpers for deriving a document form's default field values from a
// picked Customer CRM record — split out of CustomerPicker.tsx (a component
// file can only export components under react-refresh/only-export-components).

import type { CustomerRef } from '@/pages/sales/components/CustomerPicker'

function idOrEmpty(v: unknown): string | undefined {
  return v === null || v === undefined || v === '' ? undefined : String(v)
}

/** Extracts a customer record's document-defaulting fields from its CRM
 *  coreFields — undefined when the customer record has no value set. */
export function customerCoreDefaults(coreFields: Record<string, unknown>): Pick<
  CustomerRef, 'currencyId' | 'salesTaxPercent' | 'paymentTermsId' | 'priceLevelId'
> {
  return {
    currencyId: idOrEmpty(coreFields.customer_currency),
    salesTaxPercent: idOrEmpty(coreFields.customer_sales_tax_percent),
    paymentTermsId: idOrEmpty(coreFields.customer_payment_terms),
    priceLevelId: idOrEmpty(coreFields.customer_price_level),
  }
}

/** Maps a picked customer's CRM defaults onto document-form field keys
 *  (`currency_id`/`sales_tax_pct`/`payment_terms`/`price_level`) — callers
 *  merge this into form state, keeping only currently-empty keys. Forms that
 *  don't define one of these keys simply never read it back out. */
export function customerDefaultFields(customer: CustomerRef): Record<string, string> {
  const out: Record<string, string> = {}
  if (customer.currencyId !== undefined) out.currency_id = customer.currencyId
  if (customer.salesTaxPercent !== undefined) out.sales_tax_pct = customer.salesTaxPercent
  if (customer.paymentTermsId !== undefined) out.payment_terms = customer.paymentTermsId
  if (customer.priceLevelId !== undefined) out.price_level = customer.priceLevelId
  return out
}
