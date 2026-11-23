import { describe, expect, it } from 'vitest';
import {
  cutoutPatch, defaultSizeText, draftFromCutout, draftToCutout, newDraft, shapeCodeFor,
} from './cutoutForm';

const IN = { unit: 'in', fractionDenominator: 32 } as const;
const CENTER = { x: 0, y: 0 };

const sinkDraft = () => newDraft('sink', 'Sink', IN);

function saved(...args: Parameters<typeof draftToCutout>) {
  const { cutout } = draftToCutout(...args);
  if (!cutout) throw new Error('the draft did not parse');
  return cutout;
}

describe('cutout pictures in the form', () => {
  it('starts with No Picture, and carries a chosen one through to the cutout and back', () => {
    expect(sinkDraft().shapeCode).toBe('');
    const picked = saved({ ...sinkDraft(), shapeCode: 'sink.farmhouse' }, 'c1', CENTER);
    expect(picked.shapeCode).toBe('sink.farmhouse');
    expect(draftFromCutout(picked, 'Sink', IN).shapeCode).toBe('sink.farmhouse');
    expect(saved(sinkDraft(), 'c1', CENTER)).not.toHaveProperty('shapeCode');
  });

  it('clears the picture in a patch when the form is back on No Picture', () => {
    const patch = cutoutPatch(saved(sinkDraft(), 'c1', CENTER));
    expect(patch).toHaveProperty('shapeCode', undefined);
  });

  it('starts a picture at its own typical size, falling back to the type default', () => {
    expect(defaultSizeText('sink', IN, 'sink.farmhouse')).toEqual({ length: '36"', height: '18"' });
    expect(defaultSizeText('sink', IN, 'sink.nope')).toEqual({ length: '30"', height: '18"' });
  });

  it('keeps a picture only for a type that offers it', () => {
    expect(shapeCodeFor('sink', 'sink.farmhouse')).toBe('sink.farmhouse');
    expect(shapeCodeFor('cooktop', 'sink.farmhouse')).toBe('');
  });
});
