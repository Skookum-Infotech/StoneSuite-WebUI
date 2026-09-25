import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecordApprovalBanner } from './RecordApprovalBanner';
import type { ApprovalOverlay } from '@/types/tenant';

const pending: ApprovalOverlay = {
  gated: true,
  approvers: [{ id: 'a1', name: 'Alice Approver', approved: false }],
  requiredApprovals: 1,
  approvedCount: 0,
  canApprove: true,
  isOverride: false,
  callerAlreadyApproved: false,
  canReject: true,
};

const rejection = { byName: 'Alice Approver', reason: 'Wrong vendor', at: '2026-09-19T10:00:00Z' };

function renderBanner(record: ApprovalOverlay, props: { withReject?: boolean; resubmitVia?: 'edit' | 'submit' } = {}) {
  const onApprove = vi.fn();
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <RecordApprovalBanner
        record={record}
        onApprove={onApprove}
        reject={props.withReject === false ? undefined : {
          noun: 'purchase order', run: vi.fn().mockResolvedValue({}), onRejected: vi.fn(),
        }}
        resubmitVia={props.resubmitVia}
      />
    </QueryClientProvider>,
  );
  return { onApprove };
}

describe('RecordApprovalBanner', () => {
  it('renders nothing for a record that is neither awaiting approval nor rejected', () => {
    const { container } = render(
      <RecordApprovalBanner record={{ ...pending, gated: false, canReject: false }} onApprove={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('offers a configured approver both Approve and Reject while the record is pending', async () => {
    const { onApprove } = renderBanner(pending);

    expect(screen.getByText(/needs your approval/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject this purchase order' })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Approve this record' }));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['the server says the caller cannot reject', { ...pending, canReject: false }, true],
    ['the page supplies no reject action', pending, false],
  ])('hides Reject when %s', (_why, record, withReject) => {
    renderBanner(record, { withReject });
    expect(screen.queryByRole('button', { name: /^Reject this/ })).not.toBeInTheDocument();
  });

  it('offers no controls to someone who is not an approver, only who it is waiting on', () => {
    renderBanner({ ...pending, canApprove: false, canReject: false });

    expect(screen.getByText(/Awaiting approval from Alice Approver/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows who rejected the record and why, with no Approve or Reject, once it was rejected', () => {
    renderBanner({ ...pending, rejection });

    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText(/Alice Approver: "Wrong vendor"/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the rejection on a record that was sent back to Draft and is no longer gated', () => {
    renderBanner({ ...pending, gated: false, canApprove: false, canReject: false, rejection }, { resubmitVia: 'submit' });

    expect(screen.getByText(/"Wrong vendor"/)).toBeInTheDocument();
  });

  it.each([
    ['edit' as const, /Edit the record to resubmit it for approval/],
    ['submit' as const, /submit it for approval again/],
  ])('words the way back for a record resubmitted by %s', (resubmitVia, hint) => {
    renderBanner({ ...pending, rejection }, { resubmitVia });

    expect(screen.getByText(hint)).toBeInTheDocument();
  });
});
