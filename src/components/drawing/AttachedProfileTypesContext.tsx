// Hands the shop's attached-profile types to everything that draws or paints
// with them, so a piece can render its painted sides without each piece
// asking the server. The page mounts the provider once; anywhere without one
// (a read-only preview, a test) sees an empty list and simply draws nothing.

import { createContext, useContext, type ReactNode } from 'react';
import type { AttachedProfileType } from '@/types/drawing';
import { useAttachedProfileTypes } from './useAttachedProfileTypes';

const AttachedProfileTypesContext = createContext<AttachedProfileType[]>([]);

export function AttachedProfileTypesProvider({ children }: { children: ReactNode }) {
  const { types } = useAttachedProfileTypes();
  return <AttachedProfileTypesContext.Provider value={types}>{children}</AttachedProfileTypesContext.Provider>;
}

// Provider and hook live together on purpose, as in DrawingEditorContext.
// eslint-disable-next-line react-refresh/only-export-components
export function useAttachedProfileTypeList(): AttachedProfileType[] {
  return useContext(AttachedProfileTypesContext);
}
