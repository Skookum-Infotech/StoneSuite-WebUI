import { useCallback, useMemo, useRef, useState } from 'react';
import {
  copyStone,
  countErrors,
  createdOrderDefaults,
  newAreaDraft,
  stoneSource,
  toCreatePayload,
  toFormState,
  validateCreatedOrder,
} from '@/lib/createdOrderForm';
import type { CreatedOrderErrors, CreatedOrderFormState, HeaderField } from '@/lib/createdOrderForm';
import type { AreaCardActions } from '@/pages/sales/created-order/components/AreaCard';
import type { AreaKind, CreatedOrder, CreatedOrderInput } from '@/types/createdOrder';

const NO_ERRORS: CreatedOrderErrors = { header: {}, areas: {} };

/** Everything the countertop order form's fields need, whoever hosts them: the
 *  customer's page, or the tenant-side modal. */
export interface CreatedOrderDraft {
  form: CreatedOrderFormState;
  /** What the fields show: nothing until the first save attempt, then live — a
   *  blank form should not open covered in red. */
  shownErrors: CreatedOrderErrors;
  /** Required items still missing or invalid. */
  errorCount: number;
  /** How many times a save was attempted; a change tells the host to scroll to
   *  the first problem. */
  attempts: number;
  lastAddedKey: string | null;
  setHeader: (field: HeaderField, value: string) => void;
  addArea: (kind: AreaKind) => void;
  areaActions: AreaCardActions;
  /** Records a save attempt (so the errors show) and says whether the form may
   *  be sent. */
  attempt: () => boolean;
  /** The request body for the form as it stands. */
  payload: () => CreatedOrderInput;
}

/** State, validation and area actions for the countertop order form. Starts from
 *  `order` when changing a saved one, empty when placing a new one. */
export function useCreatedOrderDraft(order?: CreatedOrder): CreatedOrderDraft {
  const areaKeySeq = useRef(0);
  const [form, setForm] = useState<CreatedOrderFormState>(() =>
    order ? toFormState(order) : createdOrderDefaults(),
  );
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const errors = useMemo(
    () => validateCreatedOrder(form, new Date(), order?.installDate),
    [form, order?.installDate],
  );
  const errorCount = countErrors(errors);

  const setHeader = useCallback((field: HeaderField, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const addArea = useCallback((kind: AreaKind) => {
    areaKeySeq.current += 1;
    const key = `area-${areaKeySeq.current}`;
    setForm((prev) => ({ ...prev, areas: [...prev.areas, newAreaDraft(kind, key, prev.areas)] }));
    setLastAddedKey(key);
  }, []);

  const areaActions: AreaCardActions = useMemo(
    () => ({
      onFieldChange: (areaKey, field, value) =>
        setForm((prev) => ({
          ...prev,
          areas: prev.areas.map((area) => (area.key === areaKey ? { ...area, [field]: value } : area)),
        })),
      onRemove: (areaKey) =>
        setForm((prev) => ({ ...prev, areas: prev.areas.filter((area) => area.key !== areaKey) })),
      onCopyStone: (areaKey) =>
        setForm((prev) => {
          const source = stoneSource(prev.areas, areaKey);
          if (!source) return prev;
          return { ...prev, areas: prev.areas.map((area) => (area.key === areaKey ? copyStone(source, area) : area)) };
        }),
    }),
    [],
  );

  const attempt = useCallback((): boolean => {
    setAttempts((n) => n + 1);
    return errorCount === 0;
  }, [errorCount]);

  const payload = useCallback((): CreatedOrderInput => toCreatePayload(form), [form]);

  return {
    form,
    shownErrors: attempts > 0 ? errors : NO_ERRORS,
    errorCount,
    attempts,
    lastAddedKey,
    setHeader,
    addArea,
    areaActions,
    attempt,
    payload,
  };
}
