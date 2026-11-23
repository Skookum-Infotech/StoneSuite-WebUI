import { useCallback, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import {
  addView, loadViews, removeView, savedViewsKey, storeViews,
  type AddViewResult, type SavedView,
} from '@/lib/savedViews';

/**
 * The signed-in user's saved views for one list page, kept in this browser (see
 * lib/savedViews). `persisted` turns false once the browser refuses a write:
 * the views then last only until the page is closed, and the page still works.
 */
export function useSavedViews<S>(page: string, isState: (value: unknown) => value is S) {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const tenantId = useAuthStore((s) => s.activeTenantId);
  const key = savedViewsKey(page, userId, tenantId);

  // Re-read when the user or workspace changes, so one person's views never
  // show up under another sign-in.
  const [loaded, setLoaded] = useState(() => ({ key, views: loadViews(key, isState) }));
  const [persisted, setPersisted] = useState(true);
  if (loaded.key !== key) setLoaded({ key, views: loadViews(key, isState) });
  const views: SavedView<S>[] = loaded.key === key ? loaded.views : loadViews(key, isState);

  const commit = useCallback((next: SavedView<S>[]) => {
    setLoaded({ key, views: next });
    setPersisted(storeViews(key, next));
  }, [key]);

  const add = useCallback((name: string, state: S): AddViewResult<S> => {
    const result = addView(views, name, state);
    if (result.ok) commit(result.views);
    return result;
  }, [views, commit]);

  const remove = useCallback((id: string) => commit(removeView(views, id)), [views, commit]);

  return { views, add, remove, persisted };
}
