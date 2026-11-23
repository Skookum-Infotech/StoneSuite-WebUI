import { describe, it, expect } from 'vitest';
import { ALL_BASE_FIELDS, SECTIONS, missingRequiredLabels } from './onboardingFormFields';

const LOCATION_REQUIRED_KEYS = [
  'location_name',
  'location_address_line1',
  'location_address_city',
  'location_address_country',
  'location_address_state',
  'location_address_zip',
];

// Every required field filled with a non-blank string.
function completeForm(): Record<string, unknown> {
  return Object.fromEntries(ALL_BASE_FIELDS.filter((f) => f.required).map((f) => [f.key, 'x']));
}

describe('onboarding form field spec', () => {
  it('has no duplicate field keys (they are flat keys in one metadata blob)', () => {
    const keys = ALL_BASE_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('pairs every state field with a country field that points back at it', () => {
    const byKey = new Map(ALL_BASE_FIELDS.map((f) => [f.key, f]));
    const states = ALL_BASE_FIELDS.filter((f) => f.type === 'state');

    expect(states.length).toBeGreaterThan(0);
    for (const state of states) {
      const country = state.countryKey ? byKey.get(state.countryKey) : undefined;
      expect(country?.type, `${state.key} needs a country sibling`).toBe('country');
      expect(country?.stateKey).toBe(state.key);
    }
  });

  it('uses a state dropdown for all four address sections, not free text', () => {
    const stateKeys = ALL_BASE_FIELDS.filter((f) => f.type === 'state').map((f) => f.key);

    expect(stateKeys).toEqual([
      'location_address_state',
      'billing_address_state',
      'shipping_address_state',
      'return_address_state',
    ]);
  });

  it('marks exactly the primary location name and its street/city/country/state/zip mandatory', () => {
    const location = SECTIONS.find((s) => s.title === 'Primary Location');

    expect(location?.fields.filter((f) => f.required).map((f) => f.key)).toEqual(LOCATION_REQUIRED_KEYS);
  });

  it('leaves the billing, shipping and return addresses optional', () => {
    const optional = SECTIONS.filter((s) => /^(Billing|Shipping|Return) Address$/.test(s.title));

    expect(optional).toHaveLength(3);
    for (const section of optional) {
      expect(section.fields.some((f) => f.required)).toBe(false);
    }
  });
});

describe('missingRequiredLabels', () => {
  it('reports nothing for a complete form', () => {
    expect(missingRequiredLabels(completeForm())).toEqual([]);
  });

  it('reports every required field for an empty form, section-qualified and in form order', () => {
    expect(missingRequiredLabels({})).toEqual([
      'Company Information: Company Name',
      'Company Information: Country',
      'Company Information: Currency',
      'Primary Location: Location Name',
      'Primary Location: Address Line 1',
      'Primary Location: City',
      'Primary Location: Country',
      'Primary Location: State / Province',
      'Primary Location: Zip / Postal Code',
      'Super Admin Contact: Email',
    ]);
  });

  it.each([
    ['a blank state', { location_address_state: '' }, 'Primary Location: State / Province'],
    ['a whitespace-only name', { location_name: '   ' }, 'Primary Location: Location Name'],
    ['a non-string value', { location_address_zip: 62704 }, 'Primary Location: Zip / Postal Code'],
    ['an absent currency', { currency: undefined }, 'Company Information: Currency'],
  ])('flags %s', (_case, override, expected) => {
    expect(missingRequiredLabels({ ...completeForm(), ...override })).toEqual([expected]);
  });

  it('does not require optional fields such as the location phone or billing address', () => {
    const form = { ...completeForm(), location_phone: '', billing_address_line1: '' };

    expect(missingRequiredLabels(form)).toEqual([]);
  });
});
