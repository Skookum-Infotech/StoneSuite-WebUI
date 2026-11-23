// Low-level ASCII DXF R14 writer. Knows the file's required sections and
// the small set of entities the drawing editor exports (a closed POLYLINE
// outline, a label TEXT, and aligned DIMENSION blocks) — nothing about
// Drawing/Piece; see dxfExport.ts for that mapping.
//
// The section/table skeleton a DXF R13+ reader requires at minimum is
// documented at https://ezdxf.readthedocs.io/en/stable/dxfinternals/filestructure.html
// and was cross-checked against the real SPS sample this was proved
// against (src/test/fixtures/dxf/SO_9073_Kitchen_P1.dxf): HEADER, CLASSES
// (may be empty), TABLES (VPORT/LTYPE/LAYER/STYLE/VIEW/UCS/APPID/DIMSTYLE/
// BLOCK_RECORD), BLOCKS (*MODEL_SPACE + *PAPER_SPACE, plus one named block
// per dimension — see dxfDimensionBlock.ts), ENTITIES, and OBJECTS (a root
// DICTIONARY with one ACAD_GROUP entry).

import type { Point } from '@/types/drawing';
import { buildDimensionBlock, type DimensionBlock, type DimensionLine } from './dxfDimensionBlock';
import { HandleAllocator, pair } from './dxfPrimitives';
import {
  ARROW_SIZE_INCHES,
  DIMENSION_TEXT_HEIGHT_INCHES,
  DIMSTYLE_NAME,
  DXF_ACAD_VERSION,
  DXF_LAYER,
  DXF_LINETYPE,
  EXTENSION_OVERSHOOT_INCHES,
  TEXT_STYLE_NAME,
} from './constants';

/**
 * Builds one ENTITIES-section DXF document — outlines, labels, and
 * dimension lines — wrapped in a valid R14 HEADER/CLASSES/TABLES/BLOCKS/
 * ENTITIES/OBJECTS skeleton. One instance builds one file (build spec §6:
 * "one file per area"). All coordinates passed in are inches.
 */
export class DxfWriter {
  private readonly handles = new HandleAllocator();
  private readonly outlines: Array<{ points: Point[]; layer: string }> = [];
  private readonly labels: Array<{ text: string; at: Point; layer: string }> = [];
  private readonly lines: Array<{ from: Point; to: Point; layer: string }> = [];
  private readonly dimensions: DimensionLine[] = [];

  addOutline(points: Point[], layer: string = DXF_LAYER.OUTLINE): void {
    this.outlines.push({ points, layer });
  }

  addLabel(text: string, at: Point, layer: string = DXF_LAYER.TEXT): void {
    this.labels.push({ text, at, layer });
  }

  /** An open two-point LINE — a seam, not a closed outline. */
  addLine(from: Point, to: Point, layer: string): void {
    this.lines.push({ from, to, layer });
  }

  addAlignedDimension(from: Point, to: Point, measurementMm: number, fractionDenominator: 16 | 32): void {
    this.dimensions.push({ from, to, measurementMm, fractionDenominator });
  }

  build(): string {
    const modelSpaceRecordHandle = this.handles.alloc();
    const paperSpaceRecordHandle = this.handles.alloc();
    const dimensionBlocks = this.dimensions.map((dim, index) => buildDimensionBlock(this.handles, dim, index));
    const handseedPlaceholder = '__HANDSEED__';

    const document = [
      this.buildHeader(handseedPlaceholder),
      this.buildClasses(),
      this.buildTables(modelSpaceRecordHandle, paperSpaceRecordHandle, dimensionBlocks),
      this.buildBlocks(modelSpaceRecordHandle, paperSpaceRecordHandle, dimensionBlocks),
      this.buildEntities(modelSpaceRecordHandle, dimensionBlocks),
      this.buildObjects(),
      pair(0, 'EOF'),
    ].join('');

    // $HANDSEED only needs to be >= every handle actually used — allocate
    // it last, once every other handle has been handed out.
    return document.replace(handseedPlaceholder, this.handles.alloc());
  }

  private buildHeader(handseedPlaceholder: string): string {
    return (
      pair(0, 'SECTION') + pair(2, 'HEADER') +
      pair(9, '$ACADVER') + pair(1, DXF_ACAD_VERSION) +
      pair(9, '$INSUNITS') + pair(70, 1) + // 1 = inches
      pair(9, '$DIMASZ') + pair(40, ARROW_SIZE_INCHES) +
      pair(9, '$DIMEXE') + pair(40, EXTENSION_OVERSHOOT_INCHES) +
      pair(9, '$DIMTXT') + pair(40, DIMENSION_TEXT_HEIGHT_INCHES) +
      pair(9, '$HANDSEED') + pair(5, handseedPlaceholder) +
      pair(0, 'ENDSEC')
    );
  }

  /** Empty is a valid CLASSES section for R13+ (ezdxf). We define no
   *  dynamic blocks, so there is nothing to register here. */
  private buildClasses(): string {
    return pair(0, 'SECTION') + pair(2, 'CLASSES') + pair(0, 'ENDSEC');
  }

  private buildTables(
    modelSpaceRecordHandle: string,
    paperSpaceRecordHandle: string,
    dimensionBlocks: DimensionBlock[],
  ): string {
    const layerNames = [
      DXF_LAYER.OUTLINE, DXF_LAYER.TEXT, DXF_LAYER.DIMENSIONS, DXF_LAYER.CABINETS, DXF_LAYER.DEFPOINTS,
      DXF_LAYER.CUTOUTS, DXF_LAYER.EDGES, DXF_LAYER.NOTES, DXF_LAYER.SEAMS,
    ];
    return (
      pair(0, 'SECTION') + pair(2, 'TABLES') +
      this.table('VPORT', []) +
      this.table('LTYPE', [
        this.linetypeRecord(DXF_LINETYPE.CONTINUOUS, 'Solid line'),
        this.linetypeRecord('ByBlock', ''),
        this.linetypeRecord('ByLayer', ''),
        this.dashedLinetypeRecord(),
      ]) +
      this.table('LAYER', layerNames.map((name) => this.layerRecord(name))) +
      this.table('STYLE', [this.styleRecord()]) +
      this.table('VIEW', []) +
      this.table('UCS', []) +
      this.table('APPID', [this.appidRecord('ACAD')]) +
      this.table('DIMSTYLE', [this.dimstyleRecord()]) +
      this.table('BLOCK_RECORD', [
        this.blockRecordEntry('*MODEL_SPACE', modelSpaceRecordHandle),
        this.blockRecordEntry('*PAPER_SPACE', paperSpaceRecordHandle),
        ...dimensionBlocks.map((block) => this.blockRecordEntry(block.name, block.recordHandle)),
      ]) +
      pair(0, 'ENDSEC')
    );
  }

  private table(name: string, records: string[]): string {
    return (
      pair(0, 'TABLE') + pair(2, name) + pair(5, this.handles.alloc()) + pair(100, 'AcDbSymbolTable') +
      pair(70, records.length) + records.join('') + pair(0, 'ENDTAB')
    );
  }

  private linetypeRecord(name: string, description: string): string {
    return (
      pair(0, 'LTYPE') + pair(5, this.handles.alloc()) + pair(100, 'AcDbSymbolTableRecord') +
      pair(100, 'AcDbLinetypeTableRecord') + pair(2, name) + pair(3, description) +
      pair(70, 64) + pair(72, 65) + pair(73, 0) + pair(40, 0)
    );
  }

  private dashedLinetypeRecord(): string {
    return (
      pair(0, 'LTYPE') + pair(5, this.handles.alloc()) + pair(100, 'AcDbSymbolTableRecord') +
      pair(100, 'AcDbLinetypeTableRecord') + pair(2, DXF_LINETYPE.DASHED) + pair(3, 'Dashed') +
      pair(70, 64) + pair(72, 65) + pair(73, 2) +
      pair(40, 0.5) + pair(49, 0.25) + pair(74, 0) + pair(49, -0.25) + pair(74, 0)
    );
  }

  private layerRecord(name: string): string {
    const linetype = name === DXF_LAYER.CABINETS ? DXF_LINETYPE.DASHED : DXF_LINETYPE.CONTINUOUS;
    return (
      pair(0, 'LAYER') + pair(5, this.handles.alloc()) + pair(100, 'AcDbSymbolTableRecord') +
      pair(100, 'AcDbLayerTableRecord') + pair(70, 64) + pair(2, name) + pair(62, 7) + pair(6, linetype)
    );
  }

  private styleRecord(): string {
    return (
      pair(0, 'STYLE') + pair(5, this.handles.alloc()) + pair(100, 'AcDbSymbolTableRecord') +
      pair(100, 'AcDbTextStyleTableRecord') + pair(2, TEXT_STYLE_NAME) + pair(70, 0) +
      pair(40, 0) + pair(41, 1) + pair(50, 0) + pair(71, 0) + pair(42, 0.2) + pair(3, 'txt.shx')
    );
  }

  private appidRecord(name: string): string {
    return (
      pair(0, 'APPID') + pair(5, this.handles.alloc()) + pair(100, 'AcDbSymbolTableRecord') +
      pair(100, 'AcDbRegAppTableRecord') + pair(2, name) + pair(70, 0)
    );
  }

  private dimstyleRecord(): string {
    // Individual DIMSTYLE records use group 105 for their handle — every
    // other table record in this file uses 5.
    return (
      pair(0, 'DIMSTYLE') + pair(105, this.handles.alloc()) + pair(100, 'AcDbSymbolTableRecord') +
      pair(100, 'AcDbDimStyleTableRecord') + pair(2, DIMSTYLE_NAME) + pair(70, 0) +
      pair(40, 1) + pair(41, ARROW_SIZE_INCHES) + pair(44, EXTENSION_OVERSHOOT_INCHES) +
      pair(140, DIMENSION_TEXT_HEIGHT_INCHES) + pair(147, 0.09)
    );
  }

  private blockRecordEntry(name: string, handle: string): string {
    return (
      pair(0, 'BLOCK_RECORD') + pair(5, handle) + pair(100, 'AcDbSymbolTableRecord') +
      pair(100, 'AcDbBlockTableRecord') + pair(2, name)
    );
  }

  private buildBlocks(
    modelSpaceRecordHandle: string,
    paperSpaceRecordHandle: string,
    dimensionBlocks: DimensionBlock[],
  ): string {
    return (
      pair(0, 'SECTION') + pair(2, 'BLOCKS') +
      this.spaceBlock('*MODEL_SPACE', modelSpaceRecordHandle) +
      this.spaceBlock('*PAPER_SPACE', paperSpaceRecordHandle) +
      dimensionBlocks.map((block) => block.blockDefinition).join('') +
      pair(0, 'ENDSEC')
    );
  }

  private spaceBlock(name: string, recordHandle: string): string {
    return (
      pair(0, 'BLOCK') + pair(5, this.handles.alloc()) + pair(330, recordHandle) + pair(100, 'AcDbEntity') +
      pair(8, DXF_LAYER.OUTLINE) + pair(100, 'AcDbBlockBegin') + pair(2, name) + pair(70, 0) +
      pair(10, 0) + pair(20, 0) + pair(30, 0) + pair(3, name) +
      pair(0, 'ENDBLK') + pair(5, this.handles.alloc()) + pair(330, recordHandle) + pair(100, 'AcDbEntity') +
      pair(8, DXF_LAYER.OUTLINE) + pair(100, 'AcDbBlockEnd')
    );
  }

  private buildEntities(modelSpaceRecordHandle: string, dimensionBlocks: DimensionBlock[]): string {
    const polylines = this.outlines.map(({ points, layer }) => this.polyline(points, layer, modelSpaceRecordHandle));
    const texts = this.labels.map(({ text, at, layer }) => this.text(text, at, layer, modelSpaceRecordHandle));
    const lineEntities = this.lines.map(({ from, to, layer }) => this.line(from, to, layer, modelSpaceRecordHandle));
    const dimensionEntities = this.dimensions.map((dim, index) =>
      this.dimensionEntity(dim, dimensionBlocks[index].name, modelSpaceRecordHandle),
    );
    return (
      pair(0, 'SECTION') + pair(2, 'ENTITIES') +
      polylines.join('') + lineEntities.join('') + texts.join('') + dimensionEntities.join('') +
      pair(0, 'ENDSEC')
    );
  }

  private polyline(points: Point[], layer: string, ownerHandle: string): string {
    const header =
      pair(0, 'POLYLINE') + pair(5, this.handles.alloc()) + pair(330, ownerHandle) + pair(100, 'AcDbEntity') +
      pair(8, layer) + pair(6, DXF_LINETYPE.CONTINUOUS) + pair(100, 'AcDb2dPolyline') +
      pair(66, 1) + pair(70, 1) + pair(10, 0) + pair(20, 0) + pair(30, 0);
    const vertices = points
      .map(
        (p) =>
          pair(0, 'VERTEX') + pair(5, this.handles.alloc()) + pair(330, ownerHandle) + pair(100, 'AcDbEntity') +
          pair(8, layer) + pair(100, 'AcDbVertex') + pair(100, 'AcDb2dVertex') + pair(10, p.x) + pair(20, p.y) + pair(70, 0),
      )
      .join('');
    const seqend = pair(0, 'SEQEND') + pair(5, this.handles.alloc()) + pair(100, 'AcDbEntity') + pair(8, layer);
    return header + vertices + seqend;
  }

  private line(from: Point, to: Point, layer: string, ownerHandle: string): string {
    return (
      pair(0, 'LINE') + pair(5, this.handles.alloc()) + pair(330, ownerHandle) + pair(100, 'AcDbEntity') +
      pair(8, layer) + pair(6, DXF_LINETYPE.CONTINUOUS) + pair(100, 'AcDbLine') +
      pair(10, from.x) + pair(20, from.y) + pair(30, 0) + pair(11, to.x) + pair(21, to.y) + pair(31, 0)
    );
  }

  private text(content: string, at: Point, layer: string, ownerHandle: string): string {
    return (
      pair(0, 'TEXT') + pair(5, this.handles.alloc()) + pair(330, ownerHandle) + pair(100, 'AcDbEntity') +
      pair(8, layer) + pair(6, DXF_LINETYPE.CONTINUOUS) + pair(100, 'AcDbText') +
      pair(10, at.x) + pair(20, at.y) + pair(30, 0) + pair(40, DIMENSION_TEXT_HEIGHT_INCHES) +
      pair(1, content) + pair(50, 0) + pair(7, TEXT_STYLE_NAME) + pair(100, 'AcDbText')
    );
  }

  private dimensionEntity(dim: DimensionLine, blockName: string, ownerHandle: string): string {
    const dx = dim.to.x - dim.from.x;
    const dy = dim.to.y - dim.from.y;
    const rotationDeg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    const midpoint = { x: (dim.from.x + dim.to.x) / 2, y: (dim.from.y + dim.to.y) / 2 };
    return (
      pair(0, 'DIMENSION') + pair(5, this.handles.alloc()) + pair(330, ownerHandle) + pair(100, 'AcDbEntity') +
      pair(8, DXF_LAYER.DIMENSIONS) + pair(6, DXF_LINETYPE.CONTINUOUS) + pair(100, 'AcDbDimension') +
      pair(2, blockName) +
      pair(10, dim.to.x) + pair(20, dim.to.y) + pair(30, 0) +
      pair(11, midpoint.x) + pair(21, midpoint.y) + pair(31, 0) +
      pair(12, 0) + pair(22, 0) + pair(32, 0) +
      pair(70, 1) + pair(53, rotationDeg) + pair(3, DIMSTYLE_NAME) +
      pair(100, 'AcDbAlignedDimension') +
      pair(13, dim.from.x) + pair(23, dim.from.y) + pair(33, 0) +
      pair(14, dim.to.x) + pair(24, dim.to.y) + pair(34, 0)
    );
  }

  /** Minimum valid OBJECTS section for R13+: a root DICTIONARY with one
   *  ACAD_GROUP entry (ezdxf). We skip the per-dimension associativity
   *  dictionaries AutoCAD itself writes — advisory bookkeeping only, not
   *  required to read the file back. */
  private buildObjects(): string {
    const rootHandle = this.handles.alloc();
    const groupHandle = this.handles.alloc();
    return (
      pair(0, 'SECTION') + pair(2, 'OBJECTS') +
      pair(0, 'DICTIONARY') + pair(5, rootHandle) + pair(330, 0) + pair(100, 'AcDbDictionary') +
      pair(3, 'ACAD_GROUP') + pair(350, groupHandle) +
      pair(0, 'DICTIONARY') + pair(5, groupHandle) + pair(330, rootHandle) + pair(100, 'AcDbDictionary') +
      pair(0, 'ENDSEC')
    );
  }
}
