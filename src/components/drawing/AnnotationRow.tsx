// One line in the Seams or Dimension tool's bottom bar: what the thing is and
// how long it is, with a Delete button (and, for a dimension, one that flips
// which side its figure sits on).

import type { ReactNode } from 'react';
import { ANNOTATION_ROW_BUTTON_CLASS } from './railStyles';

export function AnnotationRow({ text, deleteLabel, onDelete, children }: {
  text: string;
  deleteLabel: string;
  onDelete: () => void;
  /** Extra buttons that sit before Delete. */
  children?: ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 text-xs text-stone-200">
      <span>{text}</span>
      <span className="flex items-center gap-1">
        {children}
        <button type="button" aria-label={deleteLabel} onClick={onDelete} className={`${ANNOTATION_ROW_BUTTON_CLASS} text-red-300`}>
          Delete
        </button>
      </span>
    </li>
  );
}

