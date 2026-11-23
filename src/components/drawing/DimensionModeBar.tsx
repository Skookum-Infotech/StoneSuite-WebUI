// The Dimension tool's bottom bar: how to measure, and every manual dimension
// already on the active area, each with Flip side and Delete. (The side figures
// the board draws on its own follow the geometry and are not listed.)

import { distance } from '@/lib/drawing/geometry';
import { formatLength } from '@/lib/drawing/units';
import type { Dimension } from '@/types/drawing';
import { AnnotationRow } from './AnnotationRow';
import { useDrawingEditor } from './DrawingEditorContext';
import { ANNOTATION_ROW_BUTTON_CLASS } from './railStyles';
import { ToolModeBar } from './ToolModeBar';

export function DimensionModeBar() {
  const { tool, setTool, state, dispatch } = useDrawingEditor();
  if (tool !== 'dimension') return null;

  const area = state.present.areas.find((a) => a.id === state.activeAreaId);
  const { displayUnit, fractionDenominator } = state.present;
  const dimensions = area?.dimensions ?? [];
  const setDimensions = (next: Dimension[]) => dispatch({ type: 'setAnnotations', areaId: state.activeAreaId, dimensions: next });

  return (
    <ToolModeBar name="Dimension tool" title="Dimension" onClose={() => setTool('select')}>
      <p className="max-w-xs text-xs text-stone-300">
        Click two points, or drag from one to the other. Corners snap.
      </p>
      {dimensions.length > 0 && (
        <ul aria-label="Dimensions on this area" className="modal-scrollbar flex max-h-32 flex-col gap-1 overflow-y-auto">
          {dimensions.map((dim, index) => (
            <AnnotationRow
              key={dim.id}
              text={`Dimension ${index + 1} · ${formatLength(distance(dim.from, dim.to), displayUnit, fractionDenominator)}`}
              deleteLabel={`Delete dimension ${index + 1}`}
              onDelete={() => setDimensions(dimensions.filter((d) => d.id !== dim.id))}
            >
              <button
                type="button"
                aria-label={`Flip dimension ${index + 1} to the other side`}
                onClick={() => setDimensions(dimensions.map((d) => (d.id === dim.id ? { ...d, from: d.to, to: d.from } : d)))}
                className={ANNOTATION_ROW_BUTTON_CLASS}
              >
                Flip side
              </button>
            </AnnotationRow>
          ))}
        </ul>
      )}
    </ToolModeBar>
  );
}
