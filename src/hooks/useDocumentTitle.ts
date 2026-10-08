import { useEffect } from 'react';
import { APP_TITLE, buildDocumentTitle } from '@/lib/documentTitle';

/** Keeps the browser-tab title in step with the current page, and restores the app
 *  name when the layout unmounts. */
export function useDocumentTitle(pathname: string, labels: Record<string, string>): void {
  useEffect(() => {
    document.title = buildDocumentTitle(pathname, labels);
    return () => {
      document.title = APP_TITLE;
    };
  }, [pathname, labels]);
}
