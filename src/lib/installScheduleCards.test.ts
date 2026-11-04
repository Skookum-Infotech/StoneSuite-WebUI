import { describe, expect, it } from 'vitest';
import { appointmentsToCards } from './installScheduleCards';
import { cardNoun, countLabel } from './plannerCards';
import type { Appointment } from '@/types/installSchedule';

function appt(over: Partial<Appointment> = {}): Appointment {
  return {
    id: 'appt-1', fabricationJobId: 'job-1', jobNumber: 'J-1042', customerName: 'Smith', siteCity: 'Austin',
    visitType: 'install', status: 'scheduled',
    startsAt: '2026-11-10T14:00:00Z', endsAt: '2026-11-10T18:00:00Z',
    startLocal: '2026-11-10T08:00', endLocal: '2026-11-10T12:00', timezone: 'America/Chicago',
    allDay: false, localStartDate: '2026-11-10', localEndDate: '2026-11-10',
    crew: [{ employeeId: 12, name: 'Ana', role: 'lead' }, { employeeId: 15, name: 'Raj', role: 'member' }],
    notes: 'Gate code 1234', cancelReason: null, version: 1, ...over,
  };
}

describe('appointmentsToCards', () => {
  it('maps a timed single-day visit field for field', () => {
    const [card] = appointmentsToCards([appt()]);
    expect(card).toMatchObject({
      id: 'appointment:appt-1:2026-11-10', kind: 'appointment', at: '2026-11-10T08:00', allDay: false,
      timeLabel: '08:00', statusLabel: 'Scheduled', title: 'J-1042', customer: 'Smith', stage: 'Install',
      href: '?appointment=appt-1', openLabel: 'Open visit', notes: 'Gate code 1234',
      done: false, overdue: false, doneLabel: '', cancelled: false,
    });
    expect(card.meta).toBe('2 crew · Austin');
    expect(card.whenLabel).toBe('Nov 10, 2026, 08:00 to 12:00');
    expect(card.ariaLabel).toBe('Install, J-1042 Smith, Nov 10, 2026, 08:00 to 12:00, 2 crew, scheduled');
    expect(card.chipColor).toMatch(/^#/);
  });

  it('expands a 3-day visit into three cards with the same id prefix on successive dates', () => {
    const cards = appointmentsToCards([
      appt({ startLocal: '2026-11-10T08:00', endLocal: '2026-11-12T12:00', localEndDate: '2026-11-12' }),
    ]);
    expect(cards.map((c) => c.id)).toEqual([
      'appointment:appt-1:2026-11-10', 'appointment:appt-1:2026-11-11', 'appointment:appt-1:2026-11-12',
    ]);
    expect(cards.map((c) => c.at.slice(0, 10))).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
    expect(cards[0].at).toBe('2026-11-10T08:00');
    expect(new Set(cards.map((c) => c.href))).toEqual(new Set(['?appointment=appt-1']));
  });

  it('places an all-day visit on the date-only row, one card per inclusive day', () => {
    const cards = appointmentsToCards([
      appt({ allDay: true, startLocal: '2026-11-10', endLocal: '2026-11-11', localEndDate: '2026-11-11' }),
    ]);
    expect(cards).toHaveLength(2);
    expect(cards.every((c) => c.allDay)).toBe(true);
    expect(cards[0]).toMatchObject({ at: '2026-11-10T00:00', timeLabel: 'All day', whenLabel: 'Nov 10, 2026 to Nov 11, 2026' });
  });

  it('marks a cancelled visit as cancelled and not done', () => {
    const [card] = appointmentsToCards([appt({ status: 'cancelled', cancelReason: 'Rain' })]);
    expect(card).toMatchObject({ statusLabel: 'Cancelled', cancelled: true, done: false });
    expect(card.ariaLabel).toContain('cancelled');
  });

  it('marks a completed visit done', () => {
    const [card] = appointmentsToCards([appt({ status: 'completed' })]);
    expect(card).toMatchObject({ statusLabel: 'Completed', done: true, cancelled: false });
  });

  it('colours by visit type and uses a muted colour when cancelled', () => {
    const [t, i, s, c] = appointmentsToCards([
      appt({ id: 'a', visitType: 'template' }), appt({ id: 'b' }), appt({ id: 'c', visitType: 'service' }),
      appt({ id: 'd', status: 'cancelled' }),
    ]);
    expect(new Set([t.chipColor, i.chipColor, s.chipColor]).size).toBe(3);
    expect(c.chipColor).not.toBe(i.chipColor);
  });

  it('falls back when job number or crew are missing', () => {
    const [card] = appointmentsToCards([appt({ jobNumber: '', crew: [], siteCity: '' })]);
    expect(card.title).toBe('Visit');
    expect(card.meta).toBe('No crew');
    expect(card.ariaLabel).toContain('no crew');
  });
});

describe('appointment card nouns', () => {
  it.each([[1, 'visit', '1 visit'], [3, 'visits', '3 visits']])('count %i', (n, noun, label) => {
    expect(cardNoun('appointment', n)).toBe(noun);
    expect(countLabel('appointment', n)).toBe(label);
  });
});
