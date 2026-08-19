import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

export interface FloatingPosition {
  left: number;
  top?: number;
  bottom?: number;
}

/**
 * Fixed-position coordinates for a portaled dropdown panel anchored to its
 * trigger, for callers that render the panel via `createPortal(..., document.body)`
 * to escape an `overflow`/`overflow-x-auto` ancestor (e.g. a scrollable table)
 * that would otherwise clip it — see StatusSelect/StatusDropdown's 'pill' variant.
 *
 * Recomputes on open. Rather than tracking the trigger's position continuously
 * (which would need a scroll/resize listener on every ancestor scroller), this
 * just closes the dropdown on scroll or resize — the trigger has moved, so a
 * stale-positioned panel would be worse than no panel.
 */
export function useFloatingDropdownPosition(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  panelWidth = 224,
): FloatingPosition | null {
  const [position, setPosition] = useState<FloatingPosition | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPosition(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - panelWidth - margin));
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openAbove = spaceBelow < 200 && spaceAbove > spaceBelow;
    setPosition(
      openAbove
        ? { left, bottom: window.innerHeight - rect.top + gap }
        : { left, top: rect.bottom + gap },
    );
  }, [open, triggerRef, panelWidth]);

  useEffect(() => {
    if (!open) return;
    // capture: true so this also catches scroll on the table's own
    // overflow-x-auto wrapper, not just window-level scroll.
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [open, onClose]);

  return position;
}
