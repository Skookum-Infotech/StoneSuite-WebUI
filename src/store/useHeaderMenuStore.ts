import { create } from 'zustand';

// Coordinates the header's icon dropdowns (Help, Notifications, Profile) so
// opening one closes any other that's already open. Without this, each
// menu's own "click outside closes" window listener never fires for a click
// on a sibling trigger button — those buttons call stopPropagation — so
// multiple dropdowns could end up open and visually overlapping at once.
export type HeaderMenuKey = 'help' | 'notifications' | 'profile';

interface HeaderMenuStore {
  openMenu: HeaderMenuKey | null;
  setOpenMenu: (menu: HeaderMenuKey | null) => void;
}

export const useHeaderMenuStore = create<HeaderMenuStore>((set) => ({
  openMenu: null,
  setOpenMenu: (menu) => set({ openMenu: menu }),
}));
