// Browser fullscreen for one element — the editor fills the screen with no app
// sidebar or header around it. Tracks the real state, so leaving with Esc
// updates the button too.

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export function useFullscreen(): { isFullscreen: boolean; toggle: (el: Element | null) => void } {
  const [isFullscreen, setIsFullscreen] = useState(() => document.fullscreenElement !== null);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = useCallback((el: Element | null) => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => toast.error("Couldn't leave full screen."));
      return;
    }
    if (!el?.requestFullscreen) {
      toast.error("Full screen isn't available in this browser.");
      return;
    }
    el.requestFullscreen().catch(() => toast.error("Couldn't enter full screen."));
  }, []);

  return { isFullscreen, toggle };
}
