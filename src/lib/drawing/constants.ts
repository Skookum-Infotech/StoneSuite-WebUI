// Shared constants for the countertop drawing editor and its DXF export.
// Values here are the ones the DXF proof (build spec §8 / "DXF proof first")
// measured out of the real SPS sample (SO_9073_Kitchen_P1) rather than
// guesses — see src/test/fixtures/dxf/README.md for how they were found.

/** $ACADVER written to every exported file — "AC1014" is DXF release 14,
 *  matching the real SPS sample and the build spec §6 table. */
export const DXF_ACAD_VERSION = 'AC1014';

export const MM_PER_INCH = 25.4;

/** The real SPS sample's dimension text resolves to the nearest 1/32" (a
 *  91 7/32" dimension was measured out of it) — this is the export default
 *  until the shop confirms it in build spec §8 item 2. */
export const DEFAULT_FRACTION_DENOMINATOR = 32;

/** Fixed layer names, matching the SPS sample and build spec §6 table. */
export const DXF_LAYER = {
  OUTLINE: '0',
  TEXT: 'TEXT',
  CABINETS: 'CABINETS',
  DIMENSIONS: 'DIMENSIONS',
  DEFPOINTS: 'DEFPOINTS',
} as const;

export const DXF_LINETYPE = {
  CONTINUOUS: 'Continuous',
  DASHED: 'dashed',
} as const;

/** Single dimension style every exported DIMENSION entity references. The
 *  real SPS sample defines one DIMSTYLE per dimension (AutoCAD's own habit
 *  of recording per-dimension text-height overrides) — our exporter writes
 *  the dimension's text directly into its block instead, so one shared
 *  style is enough. */
export const DIMSTYLE_NAME = 'Standard';
export const TEXT_STYLE_NAME = 'Standard';

/** $DIMASZ in the SPS sample — arrowhead length, in inches, at both ends of
 *  a dimension line. */
export const ARROW_SIZE_INCHES = 0.18;

/** $DIMEXE in the SPS sample — how far an extension line runs past the
 *  dimension line. */
export const EXTENSION_OVERSHOOT_INCHES = 0.18;

/** $DIMTXT in the SPS sample — dimension text height, in inches. */
export const DIMENSION_TEXT_HEIGHT_INCHES = 0.18;

// --- Editor-only constants (build spec Task 3) -----------------------------

/** The canvas's background grid spacing, and what a dragged piece snaps to
 *  — 1 inch. */
export const GRID_SIZE_MM = 25.4;

/** How close (in mm) a dragged point must be to a piece edge before it
 *  snaps to it. Not yet consumed — edge-snapping is deferred past this
 *  plan (see its Self-Review); this constant is reserved for it. */
export const SNAP_TOLERANCE_MM = 3;

/** How far outside a piece's own edge its auto-placed dimension line sits
 *  — 1 inch. */
export const DEFAULT_DIMENSION_OFFSET_MM = 25.4;
