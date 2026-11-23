import { useId } from 'react';
import type { ReactNode } from 'react';

/** What a Field hands its control so the label, error and control stay wired. */
export interface FieldControlProps {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  /** For a control that carries its own accessible name (the date picker's
   *  button): the label renders as plain text instead of a `<label for>` that
   *  would point at nothing. */
  selfLabelled?: boolean;
  children: (control: FieldControlProps) => ReactNode;
}

const LABEL_CLS = 'block text-xs font-semibold text-stone-900';

// A labelled form control. The label is a real <label for>, and the error is
// linked with aria-describedby, so a screen reader reads "Phone, required,
// invalid — Enter a valid phone number" instead of an orphaned input.
export function Field({ label, required, error, selfLabelled, children }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const labelText = (
    <>
      {label}
      {required && (
        <span className="ml-0.5 text-destructive" aria-hidden="true">
          *
        </span>
      )}
    </>
  );

  return (
    <div className="space-y-1.5">
      {selfLabelled ? (
        <span className={LABEL_CLS}>{labelText}</span>
      ) : (
        <label htmlFor={id} className={LABEL_CLS}>
          {labelText}
        </label>
      )}
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': error ? errorId : undefined,
      })}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
