// Layout classes the Week/Day and Month grids share.

// The app scrolls the whole page, not a pane, so a grid's sticky header can only
// stay in view if the grid scrolls inside a box of its own. This caps that box
// at the viewport less the chrome above it (top bar, breadcrumb, page header,
// tabs, padding); the allowance grows where the page padding does.
export const SCROLL_BOX_CLS =
  'md:max-h-[calc(100dvh-22rem)] xl:max-h-[calc(100dvh-20rem)] 3xl:max-h-[calc(100dvh-22rem)] 4xl:max-h-[calc(100dvh-24rem)]';

/** The scrolling frame both grids sit in. */
export const GRID_FRAME_CLS =
  'relative min-h-80 flex-1 overflow-auto rounded-lg border border-stone-200 bg-white modal-scrollbar';
