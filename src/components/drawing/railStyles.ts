// Class lists shared by the tool rail's plain buttons and its flyout buttons.

export const RAIL_BUTTON_CLASS = 'peer relative flex h-10 w-10 items-center justify-center rounded-xl text-stone-300 transition-colors hover:bg-stone-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:text-stone-600 disabled:hover:bg-transparent disabled:hover:text-stone-600 aria-pressed:bg-brand aria-pressed:text-stone-900 aria-pressed:shadow-sm';

/** A tool's name beside its button on hover or keyboard focus. */
export const RAIL_NAME_CLASS = 'pointer-events-none absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-stone-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity peer-hover:opacity-100 peer-focus-visible:opacity-100';

/** The corner notch that says "this opens a list". */
export const RAIL_FLYOUT_MARK_CLASS = 'absolute bottom-1 right-1 h-0 w-0 border-b-[5px] border-l-[5px] border-b-current border-l-transparent';
