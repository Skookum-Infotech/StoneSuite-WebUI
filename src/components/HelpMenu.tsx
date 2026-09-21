import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleHelp, LifeBuoy, Sparkles } from 'lucide-react';
import { AssistantPanel } from '@/components/ai/AssistantPanel';
import { useFeedbackUnreadCount } from '@/hooks/useFeedbackUnreadCount';
import { supportPath } from '@/lib/feedback';
import { useHeaderMenuStore } from '@/store/useHeaderMenuStore';
import { cn } from '@/lib/utils';

// Single "Help" entry point in the header (replaces the separate floating AI
// assistant button and the standalone feedback icon): opens a small dropdown
// with "StoneSuite Assistant" (a floating panel) and "Support" (a shortcut to
// the Support page, which also has its own sidebar entry). Rendered for both
// tenant staff and customer-portal sessions, same as the two things it
// replaces were.
export function HelpMenu() {
  const menuOpen = useHeaderMenuStore((s) => s.openMenu === 'help');
  const setOpenMenu = useHeaderMenuStore((s) => s.setOpenMenu);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const navigate = useNavigate();
  const unreadCount = useFeedbackUnreadCount();

  // Same click-outside-closes convention as MainLayout's own profile menu.
  useEffect(() => {
    if (!menuOpen) return;
    const close = (): void => setOpenMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpen, setOpenMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [menuOpen, setOpenMenu]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpenMenu(menuOpen ? null : 'help'); }}
        aria-label={unreadCount > 0 ? `Help (${unreadCount} unread)` : 'Help'}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="relative rounded-xl border border-white/10 p-2 text-stone-400 hover:bg-white/[0.06] hover:text-stone-200 transition-colors cursor-pointer"
      >
        <CircleHelp className="size-4.5" />
        {unreadCount > 0 && (
          <span className="absolute right-2 top-2 flex h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden="true" />
        )}
      </button>

      {menuOpen && (
        <div
          role="menu"
          aria-label="Help menu"
          className={cn(
            // Mobile: fixed, spanning the width under the header (mirrors the
            // header's own mobile search expansion) — anchoring to the button
            // like the sm+ dropdown does would overflow past the left edge of
            // the viewport, since the Help button isn't the rightmost header
            // control (Bell + profile sit to its right).
            'fixed inset-x-4 top-16 z-30 origin-top rounded-2xl border border-white/10 bg-[#1c1c1c] p-2 shadow-2xl ring-1 ring-white/[0.04] animate-in fade-in slide-in-from-top-1 duration-150',
            'sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2.5 sm:w-72 sm:origin-top-right',
          )}
        >
          <button
            type="button"
            role="menuitem"
            onClick={(e) => { e.stopPropagation(); setOpenMenu(null); setAssistantOpen(true); }}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06] cursor-pointer"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand">
              <Sparkles className="size-4" />
            </span>
            <span>
              <span className="block text-xs font-bold text-stone-200">StoneSuite Assistant</span>
              <span className="mt-0.5 block text-2xs text-stone-500">
                Ask about a record, workflow, or how to do something
              </span>
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(null);
              // The header dot announces an unread reply, so land where it is.
              navigate(supportPath(unreadCount > 0 ? 'tickets' : 'new'));
            }}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06] cursor-pointer"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-teal-400">
              <LifeBuoy className="size-4" />
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-1.5 text-xs font-bold text-stone-200">
                Support
                {unreadCount > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-2xs text-stone-500">
                Report a bug, request a feature, or track your tickets
              </span>
            </span>
          </button>
        </div>
      )}

      {assistantOpen && <AssistantPanel onClose={() => setAssistantOpen(false)} />}
    </div>
  );
}
