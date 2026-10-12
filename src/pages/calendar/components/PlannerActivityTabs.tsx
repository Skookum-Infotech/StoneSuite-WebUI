import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { PLANNER_PANEL_ID, plannerTabId } from '@/lib/plannerCalendar';
import type { PlannerActivity } from '@/lib/plannerCalendar';

/** The activity tabs. One activity's calendar is on screen at a time; arrow keys
 *  (and Home/End) move between tabs, as in any tablist. On a narrow screen the
 *  strip scrolls sideways and keeps the chosen tab in view. */
export function PlannerActivityTabs({ activities, activeKey, onSelect }: {
  activities: readonly PlannerActivity[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const strip = useRef<HTMLDivElement>(null);
  const activeIndex = activities.findIndex((a) => a.key === activeKey);

  // A tab chosen from the address (?activity=invoicing) can start out of sight
  // on a phone; bring it into the strip's visible span.
  useEffect(() => {
    const box = strip.current;
    const tab = buttons.current[activeIndex];
    if (!box || !tab) return;
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    if (left < box.scrollLeft) box.scrollLeft = left;
    else if (right > box.scrollLeft + box.clientWidth) box.scrollLeft = right - box.clientWidth;
  }, [activeIndex]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = activities.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = index === last ? 0 : index + 1;
        break;
      case 'ArrowLeft':
        next = index === 0 ? last : index - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    onSelect(activities[next].key);
    buttons.current[next]?.focus();
  }

  return (
    <div
      ref={strip}
      role="tablist"
      aria-label="Activity"
      className="relative flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 modal-scrollbar"
    >
      {activities.map((activity, index) => {
        const selected = activity.key === activeKey;
        return (
          <button
            key={activity.key}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            role="tab"
            id={plannerTabId(activity.key)}
            aria-selected={selected}
            aria-controls={PLANNER_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(activity.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'shrink-0 whitespace-nowrap border-b-2 -mb-px px-4 py-3 text-sm font-semibold outline-none transition-colors duration-150',
              'focus-visible:ring-2 focus-visible:ring-ring/50',
              selected
                ? 'border-brand text-stone-950'
                : 'border-transparent text-stone-500 hover:border-stone-200 hover:text-stone-700',
            )}
          >
            {activity.label}
          </button>
        );
      })}
    </div>
  );
}
