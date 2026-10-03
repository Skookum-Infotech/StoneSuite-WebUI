// After a document's customer resolves, the customer's defaults (terms, tax,
// addresses) are merged into the form. The document is the more specific
// source, so anything it supplied is put back on top.

/** Re-applies the form values the document supplied (those differing from the
 *  untouched `baseline` defaults) over `merged`, so customer defaults only fill
 *  what the document left empty. Returns a new object. */
export function overlayDocumentValues(
  merged: Record<string, unknown>,
  documentData: Record<string, unknown>,
  baseline: Record<string, unknown>,
): Record<string, unknown> {
  const supplied = Object.entries(documentData).filter(
    ([key, value]) => value !== undefined && value !== '' && value !== baseline[key],
  );
  return { ...merged, ...Object.fromEntries(supplied) };
}
