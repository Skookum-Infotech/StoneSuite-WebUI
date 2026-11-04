// Turns install-schedule visits into Activity Planner cards, so the Install
// Schedule page reuses the planner's calendar grids unchanged. A visit that
// spans several days becomes one card per day it covers.

import { formatDisplayDate } from '@/lib/dateUtils';
import { addDays } from '@/lib/plannerCalendar';
import { chipFillFor } from '@/lib/plannerChipColor';
import type { PlannerCard } from '@/lib/plannerCards';
import { PLANNER_CLOCK } from '@/lib/plannerPlacement';
import { formatWallClock, formatWallClockTime, splitWallClock } from '@/lib/salesOrderSchedule';
import type { Appointment, AppointmentStatus, VisitType } from '@/types/installSchedule';

const MIDNIGHT = '00:00';
const ALL_DAY_LABEL = 'All day';
const CONTINUED_LABEL = 'Cont.';
const OPEN_VISIT_LABEL = 'Open visit';
const FALLBACK_TITLE = 'Visit';
const NO_CREW = 'No crew';
const META_SEPARATOR = ' · ';
const RANGE_SEPARATOR = ' to ';
export const JOB_CANCELLED_LABEL = 'Job cancelled';
const MUTED_COLOR = '#a8a29e';

const VISIT_LABELS: Record<VisitType, string> = { template: 'Template', install: 'Install', service: 'Service' };
const VISIT_COLORS: Record<VisitType, string> = { template: '#0284c7', install: '#059669', service: '#d97706' };
const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function crewLabel(count: number): string {
  return count === 0 ? NO_CREW : `${count} crew`;
}

function whenLabel(a: Appointment): string {
  if (a.allDay) {
    const start = formatDisplayDate(a.localStartDate);
    return a.localEndDate === a.localStartDate ? start : `${start}${RANGE_SEPARATOR}${formatDisplayDate(a.localEndDate)}`;
  }
  const start = formatWallClock(a.startLocal, PLANNER_CLOCK);
  const end = splitWallClock(a.endLocal);
  if (!end) return start;
  const sameDay = a.localStartDate === a.localEndDate;
  return `${start}${RANGE_SEPARATOR}${sameDay ? formatWallClockTime(a.endLocal, PLANNER_CLOCK) : formatWallClock(a.endLocal, PLANNER_CLOCK)}`;
}

function daysCovered(a: Appointment): string[] {
  const days: string[] = [];
  for (let day = a.localStartDate; day <= a.localEndDate; day = addDays(day, 1)) days.push(day);
  return days.length > 0 ? days : [a.localStartDate];
}

function cardsFor(a: Appointment): PlannerCard[] {
  const cancelled = a.status === 'cancelled';
  const title = a.jobNumber || FALLBACK_TITLE;
  const color = cancelled ? MUTED_COLOR : VISIT_COLORS[a.visitType];
  const when = whenLabel(a);
  const statusLabel = STATUS_LABELS[a.status];
  const crew = crewLabel(a.crew.length);
  const jobCancelled = a.jobCancelled === true;
  const meta = [crew, a.siteCity].filter(Boolean).join(META_SEPARATOR);

  return daysCovered(a).map((day, index) => {
    const first = index === 0;
    const at = a.allDay ? `${day}T${MIDNIGHT}` : first ? a.startLocal : `${day}T${MIDNIGHT}`;
    return {
      id: `appointment:${a.id}:${day}`,
      kind: 'appointment' as const,
      at,
      sortKey: `${title}:${a.id}`,
      allDay: a.allDay,
      timeLabel: a.allDay ? ALL_DAY_LABEL : first ? formatWallClockTime(a.startLocal, PLANNER_CLOCK) : CONTINUED_LABEL,
      statusLabel,
      statusColor: color,
      chipColor: chipFillFor(color),
      whenLabel: when,
      title,
      href: `?appointment=${a.id}`,
      openLabel: OPEN_VISIT_LABEL,
      customer: a.customerName,
      stage: VISIT_LABELS[a.visitType],
      meta,
      notes: a.notes,
      doneLabel: '',
      done: a.status === 'completed',
      overdue: false,
      cancelled,
      jobCancelled,
      ariaLabel: `${VISIT_LABELS[a.visitType]}, ${title} ${a.customerName}, ${when}, ${crew.toLowerCase()}, ${statusLabel.toLowerCase()}${jobCancelled ? `, ${JOB_CANCELLED_LABEL.toLowerCase()}` : ''}`,
    };
  });
}

/** The planner cards for a list of visits, one per covered day, in feed order. */
export function appointmentsToCards(items: Appointment[]): PlannerCard[] {
  return items.flatMap(cardsFor);
}
