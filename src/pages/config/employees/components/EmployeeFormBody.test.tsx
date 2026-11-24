import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmployeeFormBody } from './EmployeeFormBody';
import { employeeDefaults } from '@/lib/employeeForm';

describe('EmployeeFormBody', () => {
  it('reports a typed first name as a new profile', async () => {
    const onChange = vi.fn();
    render(<EmployeeFormBody value={employeeDefaults()} onChange={onChange} errors={{}} />);

    await userEvent.setup().type(screen.getByLabelText('First name'), 'A');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'A' }));
  });

  it('shows each field error next to its field', () => {
    render(
      <EmployeeFormBody
        value={employeeDefaults()}
        onChange={vi.fn()}
        errors={{ firstName: 'First name is required.', email: 'Enter a valid email address.' }}
      />,
    );

    expect(screen.getByText('First name is required.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
  });

  it('locks the email of an employee who can sign in', () => {
    render(
      <EmployeeFormBody
        value={{ ...employeeDefaults(), email: 'ana@example.com' }}
        onChange={vi.fn()}
        errors={{}}
        emailLocked
      />,
    );

    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByText(/changed under Users/)).toBeInTheDocument();
  });
});
