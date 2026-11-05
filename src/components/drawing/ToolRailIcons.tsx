// The tool rail's glyphs. Each is a 20x20 stroked outline that inherits the
// button's colour, so an active button tints its icon with no extra state.

const SVG_PROPS = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'h-5 w-5',
  'aria-hidden': true,
} as const;

export function SelectIcon() {
  return <svg {...SVG_PROPS}><path d="M4 3l12 6-5 1.5L9 16 4 3z" /></svg>;
}

export function LineIcon() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M4 16L16 4" />
      <circle cx="4" cy="16" r="1.6" />
      <circle cx="16" cy="4" r="1.6" />
    </svg>
  );
}

export function ShapesIcon() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="2.5" y="4" width="9" height="6" rx="0.8" />
      <path d="M8.5 10.5h9v5.5h-9z" />
    </svg>
  );
}

export function CutoutsIcon() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.2" />
      <circle cx="10" cy="10" r="3" strokeDasharray="2 1.6" />
    </svg>
  );
}

export function NotesIcon() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M4 4h12M10 4v12" />
      <path d="M7.5 16h5" />
    </svg>
  );
}

export function MaterialsIcon() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M10 2.5l7.5 3.8L10 10 2.5 6.3 10 2.5z" />
      <path d="M2.5 10.2L10 14l7.5-3.8" />
      <path d="M2.5 13.9L10 17.7l7.5-3.8" />
    </svg>
  );
}
