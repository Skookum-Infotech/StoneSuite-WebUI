import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { PaymentDetailsSection } from './PaymentDetailsSection';
import type { CompanyProfileFormValues } from '@/lib/companyProfileForm';
import type { PaymentDetails } from '@/types/companyProfile';

const EMPTY: PaymentDetails = { bankName: '', accountNumber: '', routingNumber: '' };
const STORED: PaymentDetails = { bankName: 'Chase Bank', accountNumber: '000123456789', routingNumber: '021000021' };

// Hosts the section inside a real react-hook-form so register() is exercised.
function Harness({
  isEditing, initial = EMPTY, onSubmit = vi.fn(),
}: {
  isEditing: boolean;
  initial?: PaymentDetails;
  onSubmit?: (values: CompanyProfileFormValues) => void;
}) {
  const { register, getValues, handleSubmit, formState: { errors } } = useForm<CompanyProfileFormValues>({
    defaultValues: { paymentDetails: initial },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <PaymentDetailsSection index={4} isEditing={isEditing} values={getValues()} register={register} errors={errors} />
      <button type="submit">Save</button>
    </form>
  );
}

describe('PaymentDetailsSection', () => {
  it('shows the stored bank details in view mode', () => {
    render(<Harness isEditing={false} initial={STORED} />);
    expect(screen.getByText('Payment Details')).toBeInTheDocument();
    expect(screen.getByText('Chase Bank')).toBeInTheDocument();
    expect(screen.getByText('000123456789')).toBeInTheDocument();
    expect(screen.getByText('021000021')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows a dash for each blank detail in view mode', () => {
    render(<Harness isEditing={false} />);
    expect(screen.getAllByText('—')).toHaveLength(3);
  });

  it('offers the three fields for editing, prefilled with what is stored', () => {
    render(<Harness isEditing initial={STORED} />);
    expect(screen.getByLabelText('Bank Name')).toHaveValue('Chase Bank');
    expect(screen.getByLabelText('Account Number')).toHaveValue('000123456789');
    expect(screen.getByLabelText('Wire Routing Number')).toHaveValue('021000021');
  });

  it('submits what was typed under paymentDetails', async () => {
    const onSubmit = vi.fn();
    render(<Harness isEditing onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Bank Name'), 'Wells Fargo');
    await userEvent.type(screen.getByLabelText('Account Number'), '999888777');
    await userEvent.type(screen.getByLabelText('Wire Routing Number'), '121000248');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].paymentDetails).toEqual({
      bankName: 'Wells Fargo', accountNumber: '999888777', routingNumber: '121000248',
    });
  });
});
