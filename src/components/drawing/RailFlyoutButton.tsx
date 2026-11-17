// A rail button that opens a list of choices beside it (Border, Corner). Picking
// one arms the tool with it; pressing the button while the tool is armed puts
// it away (hands back to Select) instead of opening the list again.

import { useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { RAIL_BUTTON_CLASS, RAIL_FLYOUT_MARK_CLASS, RAIL_NAME_CLASS } from './railStyles';
import { ToolFlyout, type FlyoutItem } from './ToolFlyout';

export interface RailFlyoutTool {
  /** The button's accessible name, e.g. "Border". */
  label: string;
  /** What shows beside the button on hover, e.g. "Border (B)". */
  hint: string;
  /** The list's heading, e.g. "Borders (B)". */
  title: string;
  Icon: LucideIcon;
}

export function RailFlyoutButton({ tool, items, armed, onPick, onDisarm }: {
  tool: RailFlyoutTool;
  items: FlyoutItem[];
  armed: boolean;
  onPick: (id: string) => void;
  onDisarm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const { label, hint, title, Icon } = tool;

  return (
    <div className="relative">
      <button
        type="button"
        ref={button}
        aria-label={label}
        aria-pressed={armed}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (armed) onDisarm();
          else setOpen((was) => !was);
        }}
        className={RAIL_BUTTON_CLASS}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        <span aria-hidden="true" className={RAIL_FLYOUT_MARK_CLASS} />
      </button>
      {!open && <span aria-hidden="true" className={RAIL_NAME_CLASS}>{hint}</span>}
      {open && (
        <ToolFlyout
          title={title}
          items={items}
          onPick={(id) => {
            setOpen(false);
            onPick(id);
          }}
          onClose={(reason) => {
            setOpen(false);
            if (reason === 'escape') button.current?.focus();
          }}
        />
      )}
    </div>
  );
}
