// Pure helper for mirroring a document's Bill To fields onto its Ship To
// fields when "Is Same as Billing Customer" is checked. The fields stay
// visible and populated (see disabledIfFieldTrue in quoteForm.ts and its
// Estimate/SalesOrder/Invoice siblings) instead of hidden, so the user can
// see what will actually be used.

const BILL_TO_SHIP_KEYS: Record<string, string> = {
  bill_attn: 'ship_attn',
  bill_address1: 'ship_address1',
  bill_address2: 'ship_address2',
  bill_suite: 'ship_suite',
  bill_city: 'ship_city',
  bill_country: 'ship_country',
  bill_state: 'ship_state',
  bill_zip: 'ship_zip',
  bill_phone: 'ship_phone',
  bill_fax: 'ship_fax',
  bill_email: 'ship_email',
};

/** Copies the current Bill To fields (plus the billing customer's name) onto
 *  their Ship To equivalents — a one-time snapshot taken when "Is Same as
 *  Billing Customer" is checked, not a live mirror. The backend recomputes
 *  shipping = billing itself whenever that flag is true regardless of what's
 *  submitted (see quote/store_create.go's ShipSameAsBilling branch), so this
 *  copy is for the user's benefit — a visible preview that stays in place
 *  (and becomes independently editable) if they later uncheck the box. */
export function shipSameAsBillFields(data: Record<string, unknown>, customerName?: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [billKey, shipKey] of Object.entries(BILL_TO_SHIP_KEYS)) {
    out[shipKey] = data[billKey] ?? '';
  }
  if (customerName !== undefined) out.ship_customer = customerName;
  return out;
}
