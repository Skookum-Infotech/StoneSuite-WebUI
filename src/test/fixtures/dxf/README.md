# DXF fixtures

`SO_9073_Kitchen_P1.dxf` is a real Stone Profit Systems ("SPS") export, used
as-is to prove our own DXF writer/reader against production output rather
than against each other. It is read-only reference data — don't hand-edit
it; if a new case is needed, add a new file instead.

What it told us (see `src/lib/drawing/dxfWriter.ts` and
`dxfDimensionBlock.ts` for where each fact is used):

- Format: ASCII DXF R14 (`$ACADVER` = `AC1014`), CRLF line endings.
- Coordinates are plain inches (no `$INSUNITS` override; `$MEASUREMENT`=0).
- Piece outlines are legacy `POLYLINE`/`VERTEX`/`SEQEND` (not `LWPOLYLINE`).
- Each `DIMENSION` entity (type `AcDbAlignedDimension`) points at its own
  anonymous `*Dn` block, which pre-renders two arrowhead `SOLID` triangles,
  the dimension line split into two `LINE` segments around a text gap, and
  an `MTEXT` with the measurement. `$DIMASO` (associative dimensions) is on,
  so this geometry is expected to already be there — a reader isn't meant
  to regenerate it from the `DIMENSION` entity's own definition points.
- Dimension text is a stacked fraction via embedded MTEXT formatting codes:
  `\A1;\A1;91{\H1x;\S7/32;}"` for a 91 7/32" measurement — the leading
  `\A1;\A1;` centers it, `\H1x;` is a no-op height multiplier, and
  `\S7/32;` stacks the fraction.
- Measured precision: a dimension on this file reduces exactly to 1/32" —
  the default this repo's exporter uses until the shop confirms it (build
  spec §8 item 2).

`dxf-parser@1.1.2` (the only read-side library this repo depends on, as of
this fixture) parses the whole file without error, including the legacy
`POLYLINE` entities and all 10 `DIMENSION` blocks — see
`src/lib/drawing/dxfSpikeReadBack.test.ts`.
