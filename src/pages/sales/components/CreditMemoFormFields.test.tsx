import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreditMemoSectionGrid } from './CreditMemoFormFields';
import { PRIMARY_INFO_FIELDS } from '@/lib/creditMemoForm';

const NUMBER_FIELDS = PRIMARY_INFO_FIELDS.filter((f) => ['amount', 'sales_tax_pct', 'adjustment'].includes(f.key));
const KEYS: Record<string, string> = { Amount: 'amount', 'Sales Tax %': 'sales_tax_pct', Adjustment: 'adjustment' };

function isAccepted(label: string, value: string): boolean {
  const { unmount } = render(
    <CreditMemoSectionGrid fields={NUMBER_FIELDS} data={{ [KEYS[label]]: value }} set={() => undefined} />,
  );
  const valid = (screen.getByLabelText(label) as HTMLInputElement).validity.valid;
  unmount();
  return valid;
}

// (Adjustment has no `min`, so a browser takes its step base from the input's own
// value attribute and accepts any value — its precision is not enforced natively.)
//
// The browser's own number-input validation decides whether the form can be
// submitted, so it is asserted through the input's real ValidityState. A number
// input with no `step` accepts only whole numbers counted from `min`, which made
// an Amount of 100 fail with "nearest valid values are 99.01 and 100.01".
describe('CreditMemoField number inputs', () => {
  it.each([
    ['Amount', '100'],
    ['Amount', '100.00'],
    ['Amount', '0.01'],
    ['Amount', '99.99'],
    ['Amount', '1234.56'],
    ['Sales Tax %', '0'],
    ['Sales Tax %', '8.25'],
    ['Sales Tax %', '8.875'],
    ['Sales Tax %', '100'],
    ['Adjustment', '0'],
    ['Adjustment', '5.50'],
    ['Adjustment', '-5.5'],
  ])('%s accepts %s', (label, value) => {
    expect(isAccepted(label, value)).toBe(true);
  });

  it.each([
    ['Amount', '0'],
    ['Amount', '0.001'],
    ['Sales Tax %', '100.01'],
    ['Sales Tax %', '-1'],
    ['Sales Tax %', '8.87555'],
  ])('%s still rejects %s', (label, value) => {
    expect(isAccepted(label, value)).toBe(false);
  });
});
