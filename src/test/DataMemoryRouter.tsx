import { useState, type ReactNode } from 'react';
import { createMemoryRouter, RouterProvider, type InitialEntry } from 'react-router-dom';

/**
 * A memory router that is a *data* router, for testing pages that call
 * `useBlocker` (via useUnsavedChangesGuard) — plain `<MemoryRouter>` throws on
 * that hook. `children` is typically a `<Routes>` tree, mounted under a splat
 * route so its own path matching works unchanged.
 */
export function DataMemoryRouter({
  initialEntries,
  children,
}: {
  initialEntries: InitialEntry[];
  children: ReactNode;
}) {
  const [router] = useState(() =>
    createMemoryRouter([{ path: '*', element: children }], { initialEntries }),
  );
  return <RouterProvider router={router} />;
}
