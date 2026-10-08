import { describe, it, expect } from 'vitest';
import { parseUsAddress, resolveStateId } from './documentAddress';

describe('parseUsAddress', () => {
  it.each([
    {
      name: 'drops the party line, splits city/state/zip',
      text: 'ACME Stone Inc\n12 Main Street\nDallas, TX 75201', party: 'ACME Stone Inc',
      want: { address1: '12 Main Street', address2: '', city: 'Dallas', stateCode: 'TX', zip: '75201' },
    },
    {
      name: 'keeps a site name as line 2',
      text: 'ACME Stone - Plano Yard\n900 Quarry Road\nPlano, TX 75024', party: 'ACME Stone Inc',
      want: { address1: '900 Quarry Road', address2: 'ACME Stone - Plano Yard', city: 'Plano', stateCode: 'TX', zip: '75024' },
    },
    {
      name: 'zip+4, no comma, lower-case state',
      text: '5 Elm St\nSuite 200\nAustin tx 78701-1234', party: '',
      want: { address1: '5 Elm St', address2: 'Suite 200', city: 'Austin', stateCode: 'TX', zip: '78701-1234' },
    },
    {
      name: 'no recognizable city line leaves city/state/zip empty',
      text: 'PO Box 9\nSomewhere', party: '',
      want: { address1: 'PO Box 9', address2: 'Somewhere', city: '', stateCode: '', zip: '' },
    },
    {
      name: 'order form city and zip with no state',
      text: '418 Willow Bend\nCelina 75009', party: '',
      want: { address1: '418 Willow Bend', address2: '', city: 'Celina', stateCode: '', zip: '75009' },
    },
    {
      name: 'a lone city-and-zip line stays the street line',
      text: 'Celina 75009', party: '',
      want: { address1: 'Celina 75009', address2: '', city: '', stateCode: '', zip: '' },
    },
    {
      name: 'a PO box line is not a city',
      text: '123 Main St\nPO Box 75009', party: '',
      want: { address1: '123 Main St', address2: 'PO Box 75009', city: '', stateCode: '', zip: '' },
    },
    {
      name: 'a suite line is not a city',
      text: 'Smith Residence\nSuite 12345', party: '',
      want: { address1: 'Smith Residence', address2: 'Suite 12345', city: '', stateCode: '', zip: '' },
    },
    { name: 'empty', text: '', party: 'x', want: { address1: '', address2: '', city: '', stateCode: '', zip: '' } },
  ])('$name', ({ text, party, want }) => {
    expect(parseUsAddress(text, party)).toEqual(want);
  });
});

describe('resolveStateId', () => {
  const states = [
    { id: 43, code: 'TX', name: 'Texas', countryId: 1 },
    { id: 99, code: 'TX', name: 'Elsewhere', countryId: 2 },
  ];
  it.each([
    { code: 'TX', countryId: 1, want: '43' },
    { code: 'TX', countryId: 2, want: '99' },
    { code: 'ZZ', countryId: 1, want: '' },
    { code: '', countryId: 1, want: '' },
  ])('$code in country $countryId -> "$want"', ({ code, countryId, want }) => {
    expect(resolveStateId(states, code, countryId)).toBe(want);
  });
});
