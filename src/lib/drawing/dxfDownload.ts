// Builds the active area's DXF and hands it to the browser as a download.

import type { Drawing } from '@/types/drawing';
import { buildAreaDxf, dxfFileName } from './dxfExport';
import { DXF_CONTENT_TYPE } from './dxfFiles';

/** Builds the DXF for one area and its file name; null when the area does not exist. */
export function buildAreaExport(drawing: Drawing, areaId: string, orderNumber: string): { fileName: string; content: string } | null {
  const areaIndex = drawing.areas.findIndex((a) => a.id === areaId);
  if (areaIndex < 0) return null;
  const area = drawing.areas[areaIndex];
  const meta = {
    orderNumber, areaIndex: areaIndex + 1, seq: 1,
    fractionDenominator: drawing.fractionDenominator, displayUnit: drawing.displayUnit,
  };
  return { fileName: dxfFileName(orderNumber, area.name, meta), content: buildAreaDxf(area, meta) };
}

export function downloadDxf(fileName: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: DXF_CONTENT_TYPE }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
