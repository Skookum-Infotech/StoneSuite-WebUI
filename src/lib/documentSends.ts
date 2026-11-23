// documentSendsKey is the react-query key for one record's email history, so
// the code that sends (or transitions) a document can refresh the history card.
export const documentSendsKey = (recordId: string) => ['document-sends', recordId] as const;
