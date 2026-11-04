import { describe, expect, it } from 'vitest';
import { DXF_CONTENT_TYPE, dxfTabLabels, isDxfFileName, withDxfContentType } from './dxfFiles';

describe('isDxfFileName', () => {
  it.each([
    ['Kitchen.dxf', true],
    ['KITCHEN.DXF', true],
    ['my.plan.v2.dxf', true],
    ['Kitchen.dwg', false],
    ['dxf', false],
    ['Kitchen.dxf.pdf', false],
  ])('%s → %s', (name, expected) => {
    expect(isDxfFileName(name)).toBe(expected);
  });
});

describe('withDxfContentType', () => {
  // Browsers report '' for .dxf on most machines, which the backend's
  // allowlist (and the presigned upload it signs) rejects.
  it('gives a .dxf the canonical type even when the browser reported none', () => {
    const result = withDxfContentType(new File(['0\nEOF'], 'Kitchen.dxf', { type: '' }));
    expect(result.type).toBe(DXF_CONTENT_TYPE);
    expect(result.name).toBe('Kitchen.dxf');
  });

  it('replaces a different type a machine registered for .dxf', () => {
    const result = withDxfContentType(new File(['0\nEOF'], 'Kitchen.dxf', { type: 'image/vnd.dxf' }));
    expect(result.type).toBe(DXF_CONTENT_TYPE);
  });

  it('leaves every other file untouched', () => {
    const pdf = new File(['%PDF'], 'quote.pdf', { type: 'application/pdf' });
    expect(withDxfContentType(pdf)).toBe(pdf);
  });
});

describe('dxfTabLabels', () => {
  it('uses the file name when it is unique', () => {
    expect(dxfTabLabels([{ id: 'a', fileName: 'Kitchen.dxf' }, { id: 'b', fileName: 'Master.dxf' }]))
      .toEqual({ a: 'Kitchen.dxf', b: 'Master.dxf' });
  });

  // A re-upload adds a tab rather than replacing one, so two tabs with one
  // name need telling apart.
  it('numbers repeats of a name in the order given', () => {
    expect(dxfTabLabels([
      { id: 'a', fileName: 'Kitchen.dxf' },
      { id: 'b', fileName: 'Master.dxf' },
      { id: 'c', fileName: 'Kitchen.dxf' },
    ])).toEqual({ a: 'Kitchen.dxf', b: 'Master.dxf', c: 'Kitchen.dxf (2)' });
  });
});
