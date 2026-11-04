import { describe, it, expect } from 'vitest';
import {
  addMinutesLocal, durationOptions, emptyForm, formFromAppointment, formProblem, minutesBetween,
  toCreateBase, toLocalRange, toUpdateInput, withVisitType, START_TIMES,
} from '@/lib/installAppointmentForm';
import type { Appointment } from '@/types/installSchedule';

const visit: Appointment = {
  id: 'a1', fabricationJobId: 'j1', jobNumber: 'FJ-1', customerName: 'Acme', siteCity: 'Austin',
  visitType: 'install', status: 'scheduled', startsAt: '', endsAt: '',
  startLocal: '2099-03-03T08:00', endLocal: '2099-03-03T12:30', timezone: 'America/Chicago',
  allDay: false, localStartDate: '2099-03-03', localEndDate: '2099-03-03',
  crew: [{ employeeId: 12, name: 'Sam', role: 'lead' }], notes: 'n', cancelReason: null, version: 4,
};

describe('installAppointmentForm', () => {
  it.each([
    ['2099-03-03T08:00', 240, '2099-03-03T12:00'],
    ['2099-03-03T22:00', 180, '2099-03-04T01:00'],
    ['2099-12-31T23:45', 15, '2100-01-01T00:00'],
  ])('addMinutesLocal(%s, %i) = %s', (start, mins, expected) => {
    expect(addMinutesLocal(start, mins)).toBe(expected);
  });

  it('measures minutes between wall clocks', () => {
    expect(minutesBetween('2099-03-03T08:00', '2099-03-03T12:30')).toBe(270);
    expect(minutesBetween('bad', '2099-03-03T12:30')).toBe(0);
  });

  it('offers every quarter hour and keeps an off-list duration', () => {
    expect(START_TIMES).toHaveLength(96);
    expect(durationOptions(60)).toContain(60);
    expect(durationOptions(800)).toContain(800);
  });

  it.each([
    ['template', 60],
    ['install', 240],
    ['service', 120],
  ] as const)('switching to %s sets %i minutes', (type, mins) => {
    expect(withVisitType(emptyForm('2099-03-03'), type).durationMin).toBe(mins);
  });

  it('builds the local range for timed and all-day visits', () => {
    expect(toLocalRange({ ...emptyForm('2099-03-03'), durationMin: 90 })).toEqual({
      startLocal: '2099-03-03T08:00', endLocal: '2099-03-03T09:30',
    });
    expect(toLocalRange({ ...emptyForm('2099-03-03'), allDay: true, endDate: '2099-03-05' })).toEqual({
      startLocal: '2099-03-03', endLocal: '2099-03-05',
    });
  });

  it('round-trips an appointment into the form', () => {
    const f = formFromAppointment(visit);
    expect(f).toMatchObject({ jobId: 'j1', date: '2099-03-03', startTime: '08:00', durationMin: 270 });
    expect(f.crew).toEqual([{ employeeId: 12, role: 'lead' }]);
  });

  it('validates the form', () => {
    expect(formProblem(emptyForm('2099-03-03'))).toMatch(/fabrication job/);
    expect(formProblem(emptyForm('2099-03-03', 'j1'))).toBe('');
    expect(formProblem({ ...emptyForm('2099-03-03', 'j1'), allDay: true, endDate: '2099-03-01' })).toMatch(/last day/);
  });

  it('builds request bodies', () => {
    const form = emptyForm('2099-03-03', 'j1');
    expect(toCreateBase(form)).toMatchObject({ fabricationJobId: 'j1', startLocal: '2099-03-03T08:00', allDay: false });
    expect(toUpdateInput(form, 4, false)).not.toHaveProperty('acknowledgeConflicts');
    expect(toUpdateInput(form, 4, true)).toMatchObject({ expectedVersion: 4, acknowledgeConflicts: true });
  });
});
