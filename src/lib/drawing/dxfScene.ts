// Turns the text of an uploaded DXF into what the viewer draws. Pure, and run
// off the main thread (see dxfParseClient.ts) because the parser and the
// expansion of nested blocks both scale with what's in an untrusted file.

import DxfParser from 'dxf-parser';
import type {
  IArcEntity, IDimensionEntity, IDxf, IEntity, IInsertEntity, ILineEntity, ILwpolylineEntity,
  IMtextEntity, IPolylineEntity, ISolidEntity, ITextEntity,
} from 'dxf-parser';
import { MirrorableCircleHandler, type MirrorableCircle } from './dxfCircleHandler';
import { isFinitePoint, SceneBuilder } from './dxfSceneBuilder';
import { decodeDxfText, decodeMtext } from './dxfText';
import {
  flattenArc, flattenBulges, flattenCircle, IDENTITY, MIRROR_X, multiply, rotation, scaling,
  translation, type Matrix, type Pt,
} from './dxfTransform';
import { scanUnparsedEntities, type TypeCounts, type UnparsedEntities } from './dxfUnparsed';
import {
  DxfTooComplexError, DxfUnreadableError,
  type DxfScene, type DxfTextAnchor, type DxfTextBaseline,
} from './dxfSceneTypes';

export { DxfTooComplexError, DxfUnreadableError, type DxfScene };

const MAX_BLOCK_DEPTH = 16;
const MTEXT_LINE_SPACING = 1.4;
const DEFAULT_TEXT_HEIGHT = 1;
/** Never printed by CAD programs; holds dimension definition points. */
const HIDDEN_LAYER = 'DEFPOINTS';
const DASHED_LINETYPE_PATTERN = /dash|hidden|dot|center|phantom|divide/i;
const SECTION_MARKER_PATTERN = /^\s*SECTION\s*$/m;
const BINARY_DXF_PREFIX = 'AutoCAD Binary DXF';

const TEXT_ANCHORS: DxfTextAnchor[] = ['start', 'middle', 'end'];
const TEXT_HALIGN_MIDDLE = 4;
/** Aligned (3) and Fit (5) run between both points, so they start at the first. */
const TEXT_HALIGNS_FROM_FIRST_POINT = new Set([3, 5]);
const TEXT_ALIGN_ANCHORS: Record<number, DxfTextAnchor> = { 1: 'middle', 2: 'end', [TEXT_HALIGN_MIDDLE]: 'middle' };
const TEXT_ALIGN_BASELINES: Record<number, DxfTextBaseline> = { 1: 'text-after-edge', 2: 'middle', 3: 'hanging' };
const MTEXT_BASELINES: DxfTextBaseline[] = ['hanging', 'middle', 'text-after-edge'];
const MTEXT_COLUMNS = 3;
const IGNORED_ENTITY_TYPES = new Set(['ATTDEF']);

function hiddenLayers(dxf: IDxf): Set<string> {
  const hidden = new Set([HIDDEN_LAYER]);
  for (const layer of Object.values(dxf.tables?.layer?.layers ?? {})) {
    if (layer.visible === false || layer.frozen) hidden.add(layer.name.toUpperCase());
  }
  return hidden;
}

/** Entity → world: where it's extruded along -Z, its own coordinates are mirrored. */
function ocs(m: Matrix, extrusionZ: number | undefined): Matrix {
  return (extrusionZ ?? 1) < 0 ? multiply(m, MIRROR_X) : m;
}

class EntityWalker {
  private readonly dxf: IDxf;
  private readonly scene: SceneBuilder;
  private readonly hidden: ReadonlySet<string>;
  private readonly unparsed: UnparsedEntities;

  constructor(dxf: IDxf, scene: SceneBuilder, hidden: ReadonlySet<string>, unparsed: UnparsedEntities) {
    this.dxf = dxf;
    this.scene = scene;
    this.hidden = hidden;
    this.unparsed = unparsed;
  }

  walk(entities: IEntity[], m: Matrix, stack: string[], parentDashed: boolean) {
    for (const entity of entities) {
      if (entity.visible === false || entity.inPaperSpace) continue;
      if (this.hidden.has((entity.layer ?? '').toUpperCase())) continue;
      if (!this.draw(entity, m, stack, parentDashed)) this.scene.count(entity.type);
    }
  }

  countUnparsed(counts: TypeCounts | undefined) {
    for (const [type, count] of Object.entries(counts ?? {})) this.scene.count(type, count);
  }

  /** False when the entity couldn't be drawn, for the caller to report. */
  private draw(entity: IEntity, m: Matrix, stack: string[], parentDashed: boolean): boolean {
    const dashed = /^byblock$/i.test(entity.lineType ?? '')
      ? parentDashed
      : DASHED_LINETYPE_PATTERN.test(entity.lineType ?? '');
    switch (entity.type) {
      case 'LINE':
        return this.scene.addPath((entity as ILineEntity).vertices ?? [], m, { dashed });
      case 'LWPOLYLINE': {
        const e = entity as ILwpolylineEntity;
        return this.addPolyline(e.vertices, e.shape, ocs(m, e.extrusionDirectionZ), dashed);
      }
      case 'POLYLINE':
        return this.drawPolyline(entity as IPolylineEntity, m, dashed);
      case 'ARC': {
        const e = entity as IArcEntity;
        if (!isFinitePoint(e.center) || !Number.isFinite(e.radius) || !Number.isFinite(e.startAngle) || !Number.isFinite(e.endAngle)) return false;
        return this.scene.addPath(flattenArc(e.center, e.radius, e.startAngle, e.endAngle), ocs(m, e.extrusionDirectionZ), { dashed });
      }
      case 'CIRCLE': {
        const e = entity as MirrorableCircle;
        if (!isFinitePoint(e.center) || !Number.isFinite(e.radius)) return false;
        return this.scene.addPath(flattenCircle(e.center, e.radius), ocs(m, e.extrusionDirectionZ), { dashed, closed: true });
      }
      case 'SOLID': {
        // DXF stores a quad's corners as 1, 2, 4, 3.
        const e = entity as ISolidEntity;
        const [a, b, c, d] = e.points ?? [];
        return this.scene.addPath(d ? [a, b, d, c] : [a, b, c], ocs(m, e.extrusionDirection?.z), { dashed: false, filled: true, closed: true });
      }
      case 'TEXT':
        return this.drawText(entity as ITextEntity, m);
      case 'MTEXT':
        return this.drawMtext(entity as IMtextEntity, m);
      case 'INSERT':
        return this.drawInsert(entity as IInsertEntity, m, stack, dashed);
      case 'DIMENSION': {
        const e = entity as IDimensionEntity;
        const at = e.insertionPoint ?? { x: 0, y: 0 };
        this.drawBlock(e.block, multiply(m, translation(at.x, at.y)), stack, 'DIMENSION', dashed);
        return true;
      }
      default:
        return IGNORED_ENTITY_TYPES.has(entity.type);
    }
  }

  private addPolyline(vertices: ReadonlyArray<Pt & { bulge?: number }> | undefined, closed: boolean | undefined, m: Matrix, dashed: boolean): boolean {
    const points = flattenBulges(vertices ?? [], Boolean(closed), (count) => this.scene.spend(count));
    return this.scene.addPath(points, m, { dashed, closed, alreadySpent: true });
  }

  private drawPolyline(e: IPolylineEntity, m: Matrix, dashed: boolean): boolean {
    if (e.is3dPolygonMesh || e.isPolyfaceMesh) {
      this.scene.count('POLYLINE (mesh)');
      return true;
    }
    // A spline-fit polyline also stores the control frame it was fitted to.
    const vertices = (e.vertices ?? []).filter((v) => !v.splineControlPoint);
    return this.addPolyline(vertices, e.shape, ocs(m, e.extrusionDirection?.z), dashed);
  }

  private drawText(e: ITextEntity, m: Matrix): boolean {
    const aligned = Boolean(e.halign || e.valign) && !TEXT_HALIGNS_FROM_FIRST_POINT.has(e.halign) && isFinitePoint(e.endPoint);
    return this.scene.addText(decodeDxfText(e.text ?? ''), aligned ? e.endPoint : e.startPoint, m, {
      height: e.textHeight ?? DEFAULT_TEXT_HEIGHT,
      rotationDeg: e.rotation ?? 0,
      anchor: (aligned && TEXT_ALIGN_ANCHORS[e.halign]) || 'start',
      baseline: (aligned && (TEXT_ALIGN_BASELINES[e.valign] ?? (e.halign === TEXT_HALIGN_MIDDLE ? 'middle' : undefined))) || 'auto',
    });
  }

  private drawMtext(e: IMtextEntity, m: Matrix): boolean {
    if (!isFinitePoint(e.position)) return false;
    const lines = decodeMtext(e.text ?? '');
    const height = e.height ?? DEFAULT_TEXT_HEIGHT;
    const direction = e.directionVector;
    // Group 50 holds degrees in real files, despite the DXF reference saying radians.
    const rotationDeg = direction && (direction.x || direction.y)
      ? (Math.atan2(direction.y, direction.x) * 180) / Math.PI
      : e.rotation ?? 0;
    const attachment = (e.attachmentPoint ?? 1) - 1;
    const row = Math.floor(attachment / MTEXT_COLUMNS);
    const anchor = TEXT_ANCHORS[attachment % MTEXT_COLUMNS] ?? 'start';
    const baseline = MTEXT_BASELINES[row] ?? 'hanging';
    // How far above the attachment point the first line sits, in line heights.
    const firstLine = [0, (lines.length - 1) / 2, lines.length - 1][row] ?? 0;
    const rad = (rotationDeg * Math.PI) / 180;
    return lines
      .map((text, i) => {
        const down = (i - firstLine) * height * MTEXT_LINE_SPACING;
        const at = { x: e.position.x + down * Math.sin(rad), y: e.position.y - down * Math.cos(rad) };
        return this.scene.addText(text, at, m, { height, rotationDeg, anchor, baseline });
      })
      .every(Boolean);
  }

  private drawInsert(e: IInsertEntity, m: Matrix, stack: string[], dashed: boolean): boolean {
    if (!isFinitePoint(e.position)) return false;
    const placed = multiply(
      multiply(m, ocs(IDENTITY, e.extrusionDirection?.z)),
      multiply(translation(e.position.x, e.position.y), rotation(e.rotation ?? 0)),
    );
    const scale = scaling(e.xScale ?? 1, e.yScale ?? 1);
    const columns = e.columnCount || 1;
    const rows = e.rowCount || 1;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        this.scene.spend(1);
        // Spacing is in placed units: it rotates with the block but doesn't scale.
        const offset = translation(column * (e.columnSpacing ?? 0), row * (e.rowSpacing ?? 0));
        this.drawBlock(e.name, multiply(multiply(placed, offset), scale), stack, 'INSERT', dashed);
      }
    }
    return true;
  }

  private drawBlock(name: string | undefined, m: Matrix, stack: string[], source: string, dashed: boolean) {
    const block = name ? this.dxf.blocks?.[name] : undefined;
    if (!name || !block) {
      this.scene.count(`${source} (missing block)`);
      return;
    }
    if (stack.includes(name) || stack.length >= MAX_BLOCK_DEPTH) {
      this.scene.count(`${source} (recursive block)`);
      return;
    }
    const origin = block.position ?? { x: 0, y: 0 };
    this.walk(block.entities ?? [], multiply(m, translation(-origin.x, -origin.y)), [...stack, name], dashed);
    this.countUnparsed(this.unparsed.byBlock.get(name));
  }
}

export function buildDxfScene(text: string): DxfScene {
  if (text.startsWith(BINARY_DXF_PREFIX) || !SECTION_MARKER_PATTERN.test(text)) throw new DxfUnreadableError();
  let dxf: IDxf | null;
  try {
    const parser = new DxfParser();
    parser.registerEntityHandler(MirrorableCircleHandler);
    dxf = parser.parseSync(text);
  } catch (err) {
    throw new DxfUnreadableError(err instanceof Error ? err.message : undefined);
  }
  if (!dxf) throw new DxfUnreadableError();

  const scene = new SceneBuilder();
  const hidden = hiddenLayers(dxf);
  const unparsed = scanUnparsedEntities(text, hidden);
  const walker = new EntityWalker(dxf, scene, hidden, unparsed);
  walker.walk(dxf.entities ?? [], IDENTITY, [], false);
  walker.countUnparsed(unparsed.topLevel);
  return scene.build();
}
