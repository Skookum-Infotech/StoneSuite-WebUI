import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailStatusBadge } from './EmailStatusBadge';

const BOUNCE_MESSAGE = "The recipient's mail server rejected this email. Check the address and try again.";

describe('EmailStatusBadge', () => {
  it.each([
    ['queued', 'Queued'],
    ['sent', 'Awaiting delivery'],
    ['retrying', 'Retrying'],
    ['delayed', 'Delayed'],
    ['delivered', 'Delivered'],
    ['complained', 'Marked as spam'],
    ['bounced', 'Not delivered'],
    ['failed', 'Failed to send'],
    ['suppressed', 'Blocked address'],
    ['skipped', 'Not sent'],
  ] as const)('shows the %s status as the text "%s"', (status, label) => {
    render(<EmailStatusBadge source={{ emailStatus: status }} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each([[undefined], ['unknown' as const]])('renders nothing for %s', (status) => {
    const { container } = render(<EmailStatusBadge source={{ emailStatus: status }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the row carries no email fields at all (older backend)', () => {
    const { container } = render(<EmailStatusBadge source={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the backend message as visible text when asked, not only as a tooltip', () => {
    render(<EmailStatusBadge source={{ emailStatus: 'bounced', emailStatusMessage: BOUNCE_MESSAGE }} showMessage />);
    expect(screen.getByText(BOUNCE_MESSAGE)).toBeVisible();
  });

  it('keeps the message out of the page by default (compact list rows)', () => {
    render(<EmailStatusBadge source={{ emailStatus: 'bounced', emailStatusMessage: BOUNCE_MESSAGE }} />);
    expect(screen.queryByText(BOUNCE_MESSAGE)).not.toBeInTheDocument();
  });

  it('lists each recipient when the send had several, in the tooltip', () => {
    render(
      <EmailStatusBadge
        source={{
          emailStatus: 'bounced',
          emailRecipients: [
            { email: 'a@acme.com', status: 'delivered' },
            { email: 'b@acme.com', status: 'bounced' },
          ],
        }}
      />,
    );
    const badge = screen.getByText('Not delivered').closest('[data-email-status]');
    expect(badge).toHaveAttribute('data-email-status', 'bounced');
    expect(badge).toHaveAttribute('title', expect.stringContaining('a@acme.com: Delivered'));
    expect(badge).toHaveAttribute('title', expect.stringContaining('b@acme.com: Not delivered'));
  });

  it('does not repeat a single recipient in the tooltip', () => {
    render(<EmailStatusBadge source={{ emailStatus: 'delivered', emailRecipients: [{ email: 'a@acme.com', status: 'delivered' }] }} />);
    expect(screen.getByText('Delivered').closest('[data-email-status]')).not.toHaveAttribute(
      'title',
      expect.stringContaining('a@acme.com'),
    );
  });

  it('opens its tooltip with "Email:" so it is never mistaken for the record status', () => {
    render(<EmailStatusBadge source={{ emailStatus: 'sent' }} />);
    expect(screen.getByText('Awaiting delivery').closest('[data-email-status]')).toHaveAttribute(
      'title',
      expect.stringMatching(/^Email: Awaiting delivery\n/),
    );
  });

  it('explains an awaiting-delivery email in words on the page, so "sent" is not read as "done"', () => {
    render(<EmailStatusBadge source={{ emailStatus: 'sent' }} showMessage />);
    expect(screen.getByText(/delivery isn.t confirmed yet/i)).toBeVisible();
  });

  it('adds no paragraph for a delivered email', () => {
    render(<EmailStatusBadge source={{ emailStatus: 'delivered' }} showMessage />);
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.queryByText(/mail server accepted/i)).not.toBeInTheDocument();
  });

  it('treats an unrecognised recipient status as unknown instead of crashing', () => {
    render(
      <EmailStatusBadge
        source={{
          emailStatus: 'sent',
          emailRecipients: [
            { email: 'a@acme.com', status: 'sent' },
            // a value from a newer backend than this bundle knows about
            { email: 'b@acme.com', status: 'weird' as never },
          ],
        }}
      />,
    );
    expect(screen.getByText('Awaiting delivery').closest('[data-email-status]')).toHaveAttribute(
      'title',
      expect.stringContaining('b@acme.com: Unknown'),
    );
  });
});
