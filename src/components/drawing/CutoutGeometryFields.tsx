// The size, rotation and position fields of the cutout inspector. Every value
// is checked with cutoutPatchProblem before it is saved: a number that would
// push the opening through the piece's edge, or into another cutout, is
// refused with that reason and the cutout stays as it was.

import { useState } from 'react';
import { Select } from '@/components/ui/select';
import type { Cutout, CutoutShape, Piece, Point } from '@/types/drawing';
import {
  centerFromBoundsMm, centerFromOffsets, convertCutoutShape, cutoutArea, cutoutPatchProblem, cutoutShape,
} from '@/lib/drawing/cutouts';
import { isSimplePolygon } from '@/lib/drawing/polygon';
import { formatLength, LengthParseError, parseLength } from '@/lib/drawing/units';
import { area } from '@/lib/drawing/geometry';
import { DegreesInput } from './DegreesInput';
import { useDrawingEditor } from './DrawingEditorContext';
import { LengthInput } from './LengthInput';

const SHAPE_LABELS: Record<CutoutShape, string> = { rect: 'Rectangle', round: 'Round', polygon: 'Custom outline' };
const MIN_CUSTOM_POINTS = 3;
const MM2_PER_CM2 = 100;
const MM2_PER_SQ_IN = 645.16;

/** Parses "x y" lines (each a length) into points; throws LengthParseError naming the bad line. */
function parseOutlineLines(text: string): Point[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line, i) => {
    const parts = line.split(/[\s,;]+/).filter(Boolean);
    if (parts.length !== 2) throw new LengthParseError(`Line ${i + 1}: enter two values, like "12 -4 1/2".`);
    try {
      return { x: parseLength(parts[0]), y: parseLength(parts[1]) };
    } catch (e) {
      throw new LengthParseError(`Line ${i + 1}: ${e instanceof Error ? e.message : 'not a length.'}`);
    }
  });
}

function CustomOutlineField({ cutout, onCommit }: { cutout: Cutout; onCommit: (outline: Point[]) => string | null }) {
  const { state } = useDrawingEditor();
  const { displayUnit, fractionDenominator } = state.present;
  const shown = (cutout.outline ?? [])
    .map((p) => `${formatLength(p.x, displayUnit, fractionDenominator)} ${formatLength(p.y, displayUnit, fractionDenominator)}`)
    .join('\n');
  const [text, setText] = useState(shown);
  const [seededWith, setSeededWith] = useState(shown);
  const [error, setError] = useState<string | null>(null);
  if (seededWith !== shown) {
    setSeededWith(shown);
    setText(shown);
    setError(null);
  }

  const commit = () => {
    if (text === shown) return;
    try {
      const outline = parseOutlineLines(text);
      if (outline.length < MIN_CUSTOM_POINTS) return setError(`Enter at least ${MIN_CUSTOM_POINTS} points.`);
      if (area(outline) <= 0 || !isSimplePolygon(outline)) return setError('The outline must be a simple shape with area.');
      setError(onCommit(outline));
    } catch (e) {
      setError(e instanceof LengthParseError ? e.message : 'Enter the points as "x y" lines.');
    }
  };

  return (
    <label className="flex flex-col gap-0.5">
      Outline points (x y, from the centre)
      <textarea
        aria-label="Outline points"
        aria-invalid={error ? true : undefined}
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        className="rounded border border-stone-200 px-1.5 py-1 font-mono text-2xs"
      />
      {error && <span role="alert" className="text-2xs text-destructive">{error}</span>}
    </label>
  );
}

export function CutoutGeometryFields({ piece, cutout }: { piece: Piece; cutout: Cutout }) {
  const { state, dispatch } = useDrawingEditor();
  const shape = cutoutShape(cutout);
  const { fromLeft, fromTop } = centerFromBoundsMm(piece, cutout.center);

  /** Saves `patch` unless it would break a placement rule; returns why not. */
  const apply = (patch: Partial<Cutout>): string | null => {
    const problem = cutoutPatchProblem(piece, cutout, patch);
    if (problem) return problem;
    dispatch({ type: 'updateCutout', areaId: state.activeAreaId, pieceId: piece.id, cutoutId: cutout.id, patch });
    return null;
  };

  const positive = (key: 'widthMm' | 'depthMm' | 'diameterMm') => (mm: number) =>
    (mm > 0 ? apply({ [key]: mm }) : 'Enter a length greater than zero.');

  const [shapeError, setShapeError] = useState<string | null>(null);
  const areaMm2 = cutoutArea(cutout);
  const openingArea = state.present.displayUnit === 'mm'
    ? `${Math.round(areaMm2) / MM2_PER_CM2} cm²`
    : `${Math.round(areaMm2 / MM2_PER_SQ_IN)} sq in`;

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-0.5">
        Shape
        <Select
          aria-label="Cutout shape"
          value={shape}
          onChange={(e) => setShapeError(apply(convertCutoutShape(cutout, e.target.value as CutoutShape)))}
          className="rounded border border-stone-200 px-1.5 py-1"
        >
          {(Object.keys(SHAPE_LABELS) as CutoutShape[]).map((s) => <option key={s} value={s}>{SHAPE_LABELS[s]}</option>)}
        </Select>
        {shapeError && <span role="alert" className="text-2xs text-destructive">{shapeError}</span>}
      </label>

      {shape === 'rect' && (
        <>
          <LengthInput label="Width" valueMm={cutout.widthMm ?? 0} onCommit={positive('widthMm')} />
          <LengthInput label="Height" valueMm={cutout.depthMm ?? 0} onCommit={positive('depthMm')} />
        </>
      )}
      {shape === 'round' && <LengthInput label="Diameter" valueMm={cutout.diameterMm ?? 0} onCommit={positive('diameterMm')} />}
      {shape === 'polygon' && <CustomOutlineField cutout={cutout} onCommit={(outline) => apply({ outline })} />}

      <DegreesInput label="Cutout rotation (degrees)" valueDeg={cutout.rotationDeg ?? 0} onCommit={(deg) => apply({ rotationDeg: deg })} />
      <LengthInput
        label="Centre from left edge"
        valueMm={fromLeft}
        onCommit={(mm) => apply({ center: centerFromOffsets(piece, mm, fromTop) })}
      />
      <LengthInput
        label="Centre from top edge"
        valueMm={fromTop}
        onCommit={(mm) => apply({ center: centerFromOffsets(piece, fromLeft, mm) })}
      />
      <p className="text-2xs text-stone-500">Opening area: {openingArea}</p>
    </div>
  );
}
