import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Focus management for a hand-rolled `createPortal` modal: moves focus into
 * the dialog on open, traps Tab inside it, closes on Escape, and restores
 * focus to whatever opened it on unmount.
 *
 * This repo has no Dialog primitive in components/ui (only button/card/
 * checkbox/input/label/switch), so every dialog here builds its own overlay
 * and owns these behaviors itself. Without them a keyboard user can Tab out of
 * an "open" modal into the page behind it and act on controls they cannot see.
 *
 * Returns the ref to spread onto the dialog's content element.
 */
export function useModalDialog(onClose: () => void) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;

    // Focus the first control, falling back to the container itself so focus
    // never stays behind on the page when a dialog has no focusable content.
    const first = contentRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? contentRef.current)?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !contentRef.current) return;

      const items = Array.from(contentRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      // Wrap at both ends so Tab/Shift+Tab cycle within the dialog.
      if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      } else if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      opener?.focus?.();
    };
  }, [onClose]);

  return contentRef;
}
