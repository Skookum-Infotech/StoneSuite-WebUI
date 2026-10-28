import { Fragment, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { COPY_SOURCE_PARAM, isCopySourceId } from '@/lib/recordCopy';
import { ErrorNote, Spinner } from '@/components/tenant/ui';

const COPY_SOURCE_QUERY_KEY = 'copy-source';
const COPY_LOAD_FAILED = "That record couldn't be loaded to copy. Go back and try again.";

interface CopySeedGateProps<T> {
  /** Distinguishes one module's copy source from another's in the query cache. */
  queryKey: string;
  load: (sourceId: string) => Promise<T>;
  /** Called with the loaded record when the URL names a record to copy, or with
   *  `undefined` for an ordinary new record. */
  children: (source: T | undefined) => ReactNode;
}

/**
 * Wraps an Add page so it starts from an existing record when opened with
 * `?copyFrom=<id>`. The record is loaded before the form mounts, so the form's
 * own state can start from it instead of being patched in afterwards.
 *
 * Fetched fresh every time (no cache reuse): a copy must reflect the record as
 * it is now. A failed load shows one generic message — the server answers 404
 * for a record that is out of the caller's scope as well as one that does not
 * exist, and the UI must not tell the two apart.
 */
export function CopySeedGate<T>({ queryKey, load, children }: CopySeedGateProps<T>) {
  const [searchParams] = useSearchParams();
  const sourceId = searchParams.get(COPY_SOURCE_PARAM) ?? '';
  const malformed = sourceId !== '' && !isCopySourceId(sourceId);

  const { data, isLoading, error } = useQuery({
    queryKey: [COPY_SOURCE_QUERY_KEY, queryKey, sourceId],
    queryFn: () => load(sourceId),
    enabled: sourceId !== '' && !malformed,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (!sourceId) return <>{children(undefined)}</>;
  if (malformed) return <ErrorNote>{COPY_LOAD_FAILED}</ErrorNote>;
  if (isLoading) return <Spinner label="Loading record to copy…" />;
  if (error || data === undefined) return <ErrorNote>{COPY_LOAD_FAILED}</ErrorNote>;
  return <Fragment key={sourceId}>{children(data)}</Fragment>;
}
