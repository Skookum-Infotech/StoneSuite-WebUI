// Per-side settings (edge profile, overhang, backsplash, waterfall) and the
// quantities derived from them. Settings live in `Piece.edges`, keyed by the
// side's index; a side with nothing set has no entry. Lengths and areas are
// always computed from the outline, never stored, so they cannot drift.
//
// Overhang is recorded for the shop (how far the stone projects past its
// support) — the outline already includes it, so it adds no area here.

import type { Piece, PieceEdge } from '@/types/drawing';
import { MAX_DIMENSION_MM } from './constants';
import { distance, outlineEdges } from './geometry';

export type EdgeSettings = Partial<Omit<PieceEdge, 'index'>>;

const SETTING_KEYS = ['code', 'overhangMm', 'splashHeightMm', 'waterfallHeightMm'] as const;
const HEIGHT_FIELDS: { key: 'overhangMm' | 'splashHeightMm' | 'waterfallHeightMm'; label: string }[] = [
  { key: 'overhangMm', label: 'Overhang' },
  { key: 'splashHeightMm', label: 'Backsplash height' },
  { key: 'waterfallHeightMm', label: 'Waterfall height' },
];

export function edgeAt(edges: PieceEdge[], index: number): PieceEdge {
  return edges.find((e) => e.index === index) ?? { index };
}

/** `edges` with `patch` applied to side `index`. A key set to undefined is
 *  cleared; a side left with no settings is dropped so unset sides stay absent. */
export function setEdgeSettings(edges: PieceEdge[], index: number, patch: EdgeSettings): PieceEdge[] {
  const merged: PieceEdge = { ...edgeAt(edges, index), ...patch };
  const cleaned: PieceEdge = { index };
  for (const key of SETTING_KEYS) {
    const value = merged[key];
    if (value !== undefined && value !== '') Object.assign(cleaned, { [key]: value });
  }
  const others = edges.filter((e) => e.index !== index);
  const hasSettings = SETTING_KEYS.some((key) => cleaned[key] !== undefined);
  return (hasSettings ? [...others, cleaned] : others).sort((a, b) => a.index - b.index);
}

/** Why `patch` cannot be saved, or null. Heights are non-negative and bounded. */
export function edgeSettingsProblem(patch: EdgeSettings): string | null {
  for (const { key, label } of HEIGHT_FIELDS) {
    const value = patch[key];
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value < 0) return `${label} cannot be negative.`;
    if (value > MAX_DIMENSION_MM) return `${label} is too large.`;
  }
  return null;
}

export interface EdgeTotals {
  /** Length of finished (profiled) edge per code. */
  finishedByCode: Record<string, number>;
  finishedLengthMm: number;
  splashLengthMm: number;
  splashAreaMm2: number;
  waterfallLengthMm: number;
  waterfallAreaMm2: number;
}

export function edgeTotals(piece: Pick<Piece, 'outline' | 'edges'>): EdgeTotals {
  const totals: EdgeTotals = {
    finishedByCode: {}, finishedLengthMm: 0, splashLengthMm: 0, splashAreaMm2: 0, waterfallLengthMm: 0, waterfallAreaMm2: 0,
  };
  const sides = outlineEdges(piece.outline);
  for (const edge of piece.edges) {
    const side = sides[edge.index];
    if (!side) continue; // stale entry for a side that no longer exists
    const length = distance(side[0], side[1]);
    if (edge.code) {
      totals.finishedByCode[edge.code] = (totals.finishedByCode[edge.code] ?? 0) + length;
      totals.finishedLengthMm += length;
    }
    if (edge.splashHeightMm) {
      totals.splashLengthMm += length;
      totals.splashAreaMm2 += length * edge.splashHeightMm;
    }
    if (edge.waterfallHeightMm) {
      totals.waterfallLengthMm += length;
      totals.waterfallAreaMm2 += length * edge.waterfallHeightMm;
    }
  }
  return totals;
}

export function addEdgeTotals(a: EdgeTotals, b: EdgeTotals): EdgeTotals {
  const finishedByCode = { ...a.finishedByCode };
  for (const [code, length] of Object.entries(b.finishedByCode)) finishedByCode[code] = (finishedByCode[code] ?? 0) + length;
  return {
    finishedByCode,
    finishedLengthMm: a.finishedLengthMm + b.finishedLengthMm,
    splashLengthMm: a.splashLengthMm + b.splashLengthMm,
    splashAreaMm2: a.splashAreaMm2 + b.splashAreaMm2,
    waterfallLengthMm: a.waterfallLengthMm + b.waterfallLengthMm,
    waterfallAreaMm2: a.waterfallAreaMm2 + b.waterfallAreaMm2,
  };
}
