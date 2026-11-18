// Hands the shop's edge types to everything that draws or paints with them, so a
// piece can colour its painted sides without each piece asking the server. The
// page mounts the provider once; anywhere without one (a read-only preview, a
// test) sees an empty list and simply draws no colour.

import { createContext, useContext, type ReactNode } from 'react';
import type { EdgeType } from '@/types/drawing';
import { useEdgeTypes } from './useEdgeTypes';

const EdgeTypesContext = createContext<EdgeType[]>([]);

export function EdgeTypesProvider({ children }: { children: ReactNode }) {
  const { types } = useEdgeTypes();
  return <EdgeTypesContext.Provider value={types}>{children}</EdgeTypesContext.Provider>;
}

// Provider and hook live together on purpose, as in DrawingEditorContext.
// eslint-disable-next-line react-refresh/only-export-components
export function useEdgeTypeList(): EdgeType[] {
  return useContext(EdgeTypesContext);
}
