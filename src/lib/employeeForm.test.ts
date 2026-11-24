import { describe, it, expect } from 'vitest';
import {
  availableEmployeeTransitions,
  employeeDefaults,
  employeeName,
  employeePayload,
  employeeStatusLabel,
  employeeTransitionLabel,
  hasEmployeeErrors,
  validateEmployee,
  EMPLOYEE_NAME_MAX,
} from './employeeForm';

const valid = { ...employeeDefaults(), firstName: 'Ana', email: 'ana@example.com' };

describe('validateEmployee', () => {
  it.each([
    ['a valid profile', valid, undefined, undefined],
    ['missing first name', { ...valid, firstName: '  ' }, 'firstName', 'First name is required.'],
    ['missing email', { ...valid, email: '' }, 'email', 'Email is required.'],
    ['malformed email', { ...valid, email: 'ana@' }, 'email', 'Enter a valid email address.'],
    ['email with a display name', { ...valid, email: 'Ana <ana@example.com>' }, 'email', 'Enter a valid email address.'],
    ['over-long last name', { ...valid, lastName: 'x'.repeat(EMPLOYEE_NAME_MAX + 1) }, 'lastName', 'Last name must be at most 100 characters.'],
  ] as const)('%s', (_name, fields, key, message) => {
    const errors = validateEmployee(fields);
    if (!key) {
      expect(hasEmployeeErrors(errors)).toBe(false);
      return;
    }
    expect(errors[key]).toBe(message);
  });
});

describe('employeePayload', () => {
  it('trims every field', () => {
    const p = employeePayload({ ...valid, firstName: ' Ana ', lastName: ' Diaz ', phone: ' 555 ' });
    expect(p.firstName).toBe('Ana');
    expect(p.lastName).toBe('Diaz');
    expect(p.phone).toBe('555');
  });
});

describe('availableEmployeeTransitions', () => {
  it.each([
    ['PEND', true, ['INAC']],
    ['PEND', false, ['ACTV', 'INAC']],
    ['ACTV', false, ['INAC']],
    ['INAC', false, ['ACTV']],
    ['UNKNOWN', false, []],
  ] as const)('%s (gated=%s)', (code, gated, want) => {
    expect(availableEmployeeTransitions(code, gated)).toEqual(want);
  });
});

describe('labels', () => {
  it('names statuses and moves', () => {
    expect(employeeStatusLabel('PEND')).toBe('Pending Approval');
    expect(employeeStatusLabel('???')).toBe('???');
    expect(employeeTransitionLabel('ACTV', 'INAC')).toBe('Deactivate');
    expect(employeeTransitionLabel('INAC', 'ACTV')).toBe('Reactivate');
  });
  it('falls back to the email when there is no name', () => {
    expect(employeeName({ firstName: 'Ana', lastName: 'Diaz', email: 'a@x.com' })).toBe('Ana Diaz');
    expect(employeeName({ firstName: '', lastName: '', email: 'a@x.com' })).toBe('a@x.com');
  });
});
