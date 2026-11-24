// Fixed values for the 3D view of a drawing.

/** Standard kitchen counter height: the top face of every piece sits here. */
export const COUNTER_HEIGHT_MM = 914;

/** Used when a piece has no usable thickness (3 cm slab). */
export const DEFAULT_PIECE_THICKNESS_MM = 30;

/** Thickness of a backsplash standing on the counter. */
export const SPLASH_THICKNESS_MM = 20;

/** How deep the steel bowl under a sink opening hangs. */
export const SINK_BOWL_DEPTH_MM = 200;
export const SINK_BOWL_COLOR = '#9aa0a6';

/** A piece or opening needs at least this many points to be a shape. */
export const MIN_OUTLINE_POINTS = 3;

/** The scene is built in metres; the drawing is in millimetres. */
export const MM_TO_SCENE = 0.001;

/** How far past the pieces the floor grid reaches, as a multiple of their size. */
export const FLOOR_SPAN_FACTOR = 3;

/** Camera distance from the pieces' centre, as a multiple of their size. */
export const CAMERA_DISTANCE_FACTOR = 1.8;

export const STONE_COLOR = '#d9d4cb';
export const FLOOR_COLOR = '#f1f0ee';
/** The face of a slab you cannot see from above. */
export const UNDERSIDE_COLOR = '#2b2a28';
export const CABINET_COLOR = '#b59a78';
export const SEAM_COLOR = '#4a463f';
