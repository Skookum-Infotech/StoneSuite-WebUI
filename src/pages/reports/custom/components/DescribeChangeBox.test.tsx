import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse } from 'axios';
import type { CustomReportDefinition, CustomReportInterpretation } from '@/types/customReports';

vi.mock('@/services/customReportsService', () => ({ customReportsService: { interpret: vi.fn() } }));

import { DescribeChangeBox } from './DescribeChangeBox';
import { customReportsService } from '@/services/customReportsService';
import { CUSTOM_PROMPT_MAX_BYTES } from '@/types/customReports';

const CURRENT: CustomReportDefinition = {
  source: 'invoice_lines',
  columns: [],
  filters: [],
  groupBy: { field: 'customer.name' },
  totals: [{ fn: 'sum', field: 'net_amount' }],
  chart: 'bar',
};

const CHANGED: CustomReportInterpretation = {
  definition: { ...CURRENT, filters: [{ field: 'invoice.status', op: 'in', values: ['Paid'] }] },
  summary: 'Only paid invoices',
  dropped: [],
};

function renderBox(overrides: { onApply?: () => void; onUndo?: () => void } = {}) {
  const props = { onApply: vi.fn(), onUndo: vi.fn(), ...overrides };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DescribeChangeBox current={CURRENT} onApply={props.onApply} onUndo={props.onUndo} />
    </QueryClientProvider>,
  );
  return props;
}

function serverError(status: number, message: string): AxiosError {
  return new AxiosError(message, String(status), undefined, undefined, { status, data: { message } } as AxiosResponse);
}

async function ask(text: string): Promise<void> {
  await userEvent.type(screen.getByRole('textbox', { name: 'Describe a change' }), text);
  await userEvent.click(screen.getByRole('button', { name: 'Apply change' }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DescribeChangeBox', () => {
  it('sends the request with the report being edited and hands the result to onApply', async () => {
    vi.mocked(customReportsService.interpret).mockResolvedValue(CHANGED);
    const { onApply } = renderBox();
    await ask('only paid invoices');
    expect(customReportsService.interpret).toHaveBeenCalledWith('only paid invoices', CURRENT);
    expect(await screen.findByText('Only paid invoices')).toBeInTheDocument();
    expect(onApply).toHaveBeenCalledWith(CHANGED);
  });

  it('empties the box once the change is applied', async () => {
    vi.mocked(customReportsService.interpret).mockResolvedValue(CHANGED);
    renderBox();
    await ask('only paid invoices');
    await screen.findByText('Only paid invoices');
    expect(screen.getByRole('textbox', { name: 'Describe a change' })).toHaveValue('');
  });

  it('puts the report back as it was when the change is undone', async () => {
    vi.mocked(customReportsService.interpret).mockResolvedValue(CHANGED);
    const { onUndo } = renderBox();
    await ask('only paid invoices');
    await userEvent.click(await screen.findByRole('button', { name: 'Undo this change' }));
    expect(onUndo).toHaveBeenCalledWith(CURRENT);
    expect(screen.queryByText('Only paid invoices')).not.toBeInTheDocument();
  });

  it('says what it had to leave out', async () => {
    vi.mocked(customReportsService.interpret).mockResolvedValue({ ...CHANGED, dropped: ['ghost field'] });
    renderBox();
    await ask('something odd');
    expect(await screen.findByText(/I left out: ghost field/)).toBeInTheDocument();
  });

  it('shows the server message when the assistant is unavailable and leaves the box usable', async () => {
    vi.mocked(customReportsService.interpret).mockRejectedValue(
      serverError(503, 'The AI assistant is not available right now. You can still build the report by hand.'),
    );
    const { onApply } = renderBox();
    await ask('only paid invoices');
    expect(await screen.findByRole('alert')).toHaveTextContent('You can still build the report by hand.');
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Describe a change' })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: 'Describe a change' })).toHaveValue('only paid invoices');
  });

  it('shows the server message when the request could not be understood', async () => {
    vi.mocked(customReportsService.interpret).mockRejectedValue(serverError(422, "I couldn't turn that into a report."));
    renderBox();
    await ask('blah');
    expect(await screen.findByRole('alert')).toHaveTextContent("I couldn't turn that into a report.");
  });

  it('warns that the first request can take a minute, and locks the box while waiting', async () => {
    vi.mocked(customReportsService.interpret).mockReturnValue(new Promise(() => undefined));
    renderBox();
    await ask('only paid invoices');
    expect(await screen.findByRole('status')).toHaveTextContent(/up to a minute/);
    expect(screen.getByRole('textbox', { name: 'Describe a change' })).toBeDisabled();
  });

  it('refuses a request over the byte limit before sending it', () => {
    renderBox();
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe a change' }), { target: { value: 'a'.repeat(CUSTOM_PROMPT_MAX_BYTES + 1) } });
    expect(screen.getByText('Please shorten your request.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply change' })).toBeDisabled();
    expect(customReportsService.interpret).not.toHaveBeenCalled();
  });

  it('keeps Apply change off until something is typed', async () => {
    renderBox();
    expect(screen.getByRole('button', { name: 'Apply change' })).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'Describe a change' }), 'x');
    expect(screen.getByRole('button', { name: 'Apply change' })).toBeEnabled();
  });
});

describe('DescribeChangeBox accessibility', () => {
  it('announces a too-long request and marks the box invalid', () => {
    renderBox();
    const box = screen.getByRole('textbox', { name: 'Describe a change' });
    fireEvent.change(box, { target: { value: 'a'.repeat(CUSTOM_PROMPT_MAX_BYTES + 1) } });
    expect(screen.getByRole('alert')).toHaveTextContent('Please shorten your request.');
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAccessibleDescription('Please shorten your request.');
  });
});
