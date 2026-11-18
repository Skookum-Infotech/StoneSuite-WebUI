import { describe, expect, it } from 'vitest';
import type { Piece } from '@/types/drawing';
import { rectOutline } from '../geometry';
import { COUNTER_HEIGHT_MM, SPLASH_THICKNESS_MM } from './constants';
import { buildPanels } from './panels';

function piece(edges: Piece['edges']): Piece {
  return {
    id: 'p', label: 'A-1', shape: 'rect', outline: rectOutline(1000, 600), position: { x: 0, y: 0 },
    rotationDeg: 0, thicknessMm: 30, edges, seams: [], cutouts: [],
  };
}

describe('buildPanels', () => {
  it('makes nothing when no side asks for a splash or waterfall', () => {
    expect(buildPanels(piece([{ index: 0, code: 'E' }]), 30)).toEqual([]);
  });

  it('stands a backsplash on the counter, set in towards the middle of the piece', () => {
    // Side 0 runs (0,0) -> (1000,0); the stone lies below it (y < 0), so "in" is -y.
    const [splash] = buildPanels(piece([{ index: 0, splashHeightMm: 100 }]), 30);
    expect(splash.kind).toBe('splash');
    expect(splash.baseMm).toBe(COUNTER_HEIGHT_MM);
    expect(splash.heightMm).toBe(100);
    expect(splash.footprint.map((p) => p.y)).toEqual([0, 0, -SPLASH_THICKNESS_MM, -SPLASH_THICKNESS_MM]);
  });

  it('drops a waterfall from the top face down, as thick as the slab', () => {
    const [fall] = buildPanels(piece([{ index: 1, waterfallHeightMm: 800 }]), 30);
    expect(fall.kind).toBe('waterfall');
    expect(fall.baseMm).toBe(COUNTER_HEIGHT_MM - 800);
    expect(fall.heightMm).toBe(800);
    // Side 1 is the right-hand side (x = 1000); inward is -x, 30 mm deep.
    expect(Math.min(...fall.footprint.map((p) => p.x))).toBeCloseTo(970);
  });

  it('follows a curved side with several walls', () => {
    const many = buildPanels(piece([{ index: 0, splashHeightMm: 100, arcHeightMm: 120 }]), 30);
    expect(many.length).toBeGreaterThan(1);
  });

  it('moves with the piece', () => {
    const moved = { ...piece([{ index: 0, splashHeightMm: 100 }]), position: { x: 500, y: 200 } };
    const [splash] = buildPanels(moved, 30);
    expect(splash.footprint[0]).toEqual({ x: 500, y: 200 });
  });
});
