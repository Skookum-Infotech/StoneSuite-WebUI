// The fill of a small calendar chip. A chip is a solid block of the status
// colour with white text on it — the Google Calendar look — but the status
// colours are tuned for tinted pills, and several (amber, emerald) are too light
// to carry 12px white text. So each is darkened, step by step and keeping its
// hue, until white text on it reaches WCAG AA contrast.

const WHITE_TEXT_MIN_CONTRAST = 4.5;
/** Each pass keeps this share of every channel. */
const DARKEN_FACTOR = 0.94;
/** Far more passes than any colour needs; pure black is reached well inside this. */
const MAX_DARKEN_STEPS = 60;
/** Stone-600: what a value that isn't a hex colour falls back to. */
const FALLBACK_FILL = '#57534e';

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const HEX_RADIX = 16;
const SHORT_HEX_LENGTH = 3;
const BITS_PER_CHANNEL = 8;
const CHANNEL_MASK = 0xff;
const CHANNEL_MAX = 255;
// sRGB → linear light, and the luminance weights of the three primaries (WCAG).
const SRGB_LINEAR_THRESHOLD = 0.04045;
const SRGB_LINEAR_DIVISOR = 12.92;
const SRGB_GAMMA_OFFSET = 0.055;
const SRGB_GAMMA_DIVISOR = 1.055;
const SRGB_GAMMA = 2.4;
const LUMA_RED = 0.2126;
const LUMA_GREEN = 0.7152;
const LUMA_BLUE = 0.0722;
const CONTRAST_OFFSET = 0.05;
const WHITE_LUMINANCE = 1;

type Rgb = [red: number, green: number, blue: number];

function parseHex(value: string): Rgb | null {
  const match = HEX_PATTERN.exec(value.trim());
  if (!match) return null;
  const digits = match[1].length === SHORT_HEX_LENGTH ? [...match[1]].map((d) => d + d).join('') : match[1];
  const packed = parseInt(digits, HEX_RADIX);
  return [
    (packed >> (BITS_PER_CHANNEL * 2)) & CHANNEL_MASK,
    (packed >> BITS_PER_CHANNEL) & CHANNEL_MASK,
    packed & CHANNEL_MASK,
  ];
}

function toHex([red, green, blue]: Rgb): string {
  return `#${[red, green, blue].map((c) => c.toString(HEX_RADIX).padStart(2, '0')).join('')}`;
}

function linearLight(channel: number): number {
  const c = channel / CHANNEL_MAX;
  if (c <= SRGB_LINEAR_THRESHOLD) return c / SRGB_LINEAR_DIVISOR;
  return ((c + SRGB_GAMMA_OFFSET) / SRGB_GAMMA_DIVISOR) ** SRGB_GAMMA;
}

function contrastRgb([red, green, blue]: Rgb): number {
  const luminance = LUMA_RED * linearLight(red) + LUMA_GREEN * linearLight(green) + LUMA_BLUE * linearLight(blue);
  return (WHITE_LUMINANCE + CONTRAST_OFFSET) / (luminance + CONTRAST_OFFSET);
}

function darken([red, green, blue]: Rgb): Rgb {
  return [red, green, blue].map((c) => Math.floor(c * DARKEN_FACTOR)) as Rgb;
}

/** WCAG contrast ratio of white text on `hex`, 1 (white on white) to 21 (on black);
 *  0 when `hex` isn't a colour. */
export function contrastWithWhite(hex: string): number {
  const rgb = parseHex(hex);
  return rgb ? contrastRgb(rgb) : 0;
}

/** `hex` darkened until white text on it is readable, as lowercase `#rrggbb`.
 *  A colour that already reads on white is returned as it is. */
export function chipFillFor(hex: string): string {
  let rgb = parseHex(hex);
  if (!rgb) return FALLBACK_FILL;
  for (let step = 0; step < MAX_DARKEN_STEPS && contrastRgb(rgb) < WHITE_TEXT_MIN_CONTRAST; step += 1) {
    rgb = darken(rgb);
  }
  return toHex(rgb);
}
