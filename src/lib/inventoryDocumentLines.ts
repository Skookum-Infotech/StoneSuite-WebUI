// The inventory document endpoints tag their line slice `json:"lines,omitempty"`,
// so the key is dropped from the response whenever a document has no lines —
// which is the normal state of every freshly created count (lines are only
// built by the freeze). The app-facing types promise `lines: T[]`, so services
// run the wire payload through this before handing it on; without it a draft
// blows up the detail page on `lines.length`.
export function withLines<L, T extends { lines?: L[] | null }>(
  doc: T,
): Omit<T, 'lines'> & { lines: L[] } {
  return { ...doc, lines: doc.lines ?? [] };
}
