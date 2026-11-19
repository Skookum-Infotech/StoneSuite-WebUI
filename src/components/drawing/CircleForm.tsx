// The radius number for the Draw tool's Circle mode: typing it and clicking
// Apply arms the radius the next canvas click places a circle at — the same
// "type numbers, Apply arms the tool" shape Border/Corner's own forms use
// (MeasurementsForm), just with one field and no piece to apply it to yet.

import { MeasurementsForm } from './MeasurementsForm';
import { useDrawingEditor } from './DrawingEditorContext';

export function CircleForm() {
  const { draw } = useDrawingEditor();

  const apply = (values: Record<'radius', number>): string | null => {
    if (!(values.radius > 0)) return 'Radius must be greater than 0.';
    draw.setCircleRadiusMm(values.radius);
    return null;
  };

  return (
    <MeasurementsForm
      label="Circle radius"
      fields={[{ key: 'radius', letters: 'R', caption: 'Radius' }]}
      values={{ radius: draw.circleRadiusMm }}
      onPreview={(values) => draw.setCircleRadiusMm(values.radius)}
      onApply={apply}
    />
  );
}
