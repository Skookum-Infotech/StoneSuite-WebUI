import { create } from 'zustand';

// The last route the user viewed outside the Support page. Tickets are filed
// from /support, so by the time the form renders the router is already there —
// this remembers where the reporter actually was, for the ticket's "Where did
// this happen?" default and its `pageUrl`. In memory only: it means nothing
// once the page has been reloaded.
interface LastAppPathStore {
  /** pathname + search, or '' before any non-Support route has been seen. */
  path: string;
  setPath: (path: string) => void;
}

export const useLastAppPathStore = create<LastAppPathStore>((set) => ({
  path: '',
  setPath: (path) => set({ path }),
}));
