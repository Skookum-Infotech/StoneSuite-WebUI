import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isSupportPath } from '@/lib/feedback';
import { useLastAppPathStore } from '@/store/useLastAppPathStore';

// Mounted once by MainLayout. Keeps useLastAppPathStore pointed at the page the
// user is on — except while they are on the Support page itself, where it
// deliberately holds the previous page, since that is what a ticket describes.
export function useTrackLastAppPath(): void {
  const { pathname, search } = useLocation();
  const setPath = useLastAppPathStore((s) => s.setPath);

  useEffect(() => {
    if (isSupportPath(pathname)) return;
    setPath(pathname + search);
  }, [pathname, search, setPath]);
}
