export type CitationSourceType = 'record' | 'help';

export interface Citation {
  source_type: CitationSourceType;
  source_id: string;
  snippet: string;
}

export interface AskResult {
  answer: string;
  citations: Citation[];
}
