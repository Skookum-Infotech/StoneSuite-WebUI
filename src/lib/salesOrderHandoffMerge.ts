// After a document's customer resolves (or the reviewer picks one), the
// customer's defaults (terms, tax, addresses) are merged into the form. The
// document is the more specific source, so anything it supplied is put back on
// top.

/** The address fields that make up one Bill To / Ship To block. */
const ADDRESS_PARTS = ['address1', 'address2', 'suite', 'city', 'state', 'zip'] as const;
const ADDRESS_PREFIXES = ['bill', 'ship'] as const;

/** True when the document supplied any part of the `<prefix>_*` address. */
function documentHasAddress(documentData: Record<string, unknown>, prefix: string): boolean {
  return ADDRESS_PARTS.some((part) => {
    const v = documentData[`${prefix}_${part}`];
    return v !== undefined && v !== '';
  });
}

/** Re-applies the form values the document supplied (those differing from the
 *  untouched `baseline` defaults) over `merged`, so customer defaults only fill
 *  what the document left empty. An address block the document supplied is
 *  taken from the document as a whole — the customer's stored street, suite or
 *  zip must never mix into it — and a document Ship To keeps "same as billing"
 *  off. Returns a new object. */
export function overlayDocumentValues(
  merged: Record<string, unknown>,
  documentData: Record<string, unknown>,
  baseline: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...merged };
  ADDRESS_PREFIXES.forEach((prefix) => {
    if (!documentHasAddress(documentData, prefix)) return;
    ADDRESS_PARTS.forEach((part) => { out[`${prefix}_${part}`] = ''; });
    if (prefix === 'ship') out.ship_same_as_bill = false;
  });
  const supplied = Object.entries(documentData).filter(
    ([key, value]) => value !== undefined && value !== '' && value !== baseline[key],
  );
  return { ...out, ...Object.fromEntries(supplied) };
}
