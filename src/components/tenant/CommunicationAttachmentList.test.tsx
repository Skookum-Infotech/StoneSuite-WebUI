import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/recordEmailService', () => ({
  recordEmailService: { downloadAttachment: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { CommunicationAttachmentList } from './CommunicationAttachmentList';
import { recordEmailService } from '@/services/recordEmailService';
import { toast } from 'sonner';
import type { RecordEmailAttachment } from '@/types/recordEmail';

const RECORD_ID = 'rec-1';

function attachment(over: Partial<RecordEmailAttachment> = {}): RecordEmailAttachment {
  return { id: 'a1', fileName: 'plan.pdf', contentType: 'application/pdf', sizeBytes: 2048, inline: false, status: 'stored', ...over };
}

function renderList(attachments: RecordEmailAttachment[], missingCount = 0) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CommunicationAttachmentList recordId={RECORD_ID} attachments={attachments} missingCount={missingCount} />
    </QueryClientProvider>,
  );
}

let clicked: HTMLAnchorElement[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  clicked = [];
  // jsdom cannot navigate: record the link the download would have followed.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this);
  });
});

afterEach(() => vi.restoreAllMocks());

describe('CommunicationAttachmentList', () => {
  it('shows a kept file as a download button with its size', () => {
    renderList([attachment()]);

    const button = screen.getByRole('button', { name: 'Download plan.pdf' });
    expect(button).toHaveTextContent('plan.pdf');
    expect(button).toHaveTextContent('2 KB');
    expect(screen.getByRole('list', { name: 'Attachments' })).toBeInTheDocument();
  });

  it('shows a file still being copied as such, with nothing to click', () => {
    renderList([attachment({ status: 'pending' })]);

    expect(screen.getByText('Copying…')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each([
    ['too_large', 'Too large to keep', /larger than the limit/],
    ['blocked', 'Not kept for safety', /never kept/],
    ['unavailable', 'Not available', /could not be kept/],
  ] as const)('shows a %s file with its reason and nothing to click', (status, label, detail) => {
    renderList([attachment({ status, fileName: 'thing.bin' })]);

    expect(screen.getByText('thing.bin')).toBeInTheDocument();
    const chip = screen.getByText(label).closest('span[title]');
    expect(chip).toHaveAttribute('title', expect.stringMatching(detail));
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('lists several files in order, each in its own state', () => {
    renderList([
      attachment({ id: 'a1', fileName: 'one.pdf' }),
      attachment({ id: 'a2', fileName: 'two.exe', status: 'blocked' }),
      attachment({ id: 'a3', fileName: 'three.jpg', status: 'pending' }),
    ]);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('one.pdf');
    expect(items[1]).toHaveTextContent('Not kept for safety');
    expect(items[2]).toHaveTextContent('Copying…');
  });

  it('says how many files were not kept for a message from before files were kept', () => {
    renderList([], 1);
    expect(screen.getByText('This email had 1 attachment that was not kept.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('pluralizes that line, and shows it beside the files that were kept', () => {
    renderList([attachment()], 2);
    expect(screen.getByText('This email had 2 attachments that were not kept.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download plan.pdf' })).toBeInTheDocument();
  });

  it('says nothing about missing files when there are none', () => {
    renderList([attachment()], 0);
    expect(screen.queryByText(/not kept/)).toBeNull();
  });

  it('asks for a link to that file of that record and follows it as a download', async () => {
    vi.mocked(recordEmailService.downloadAttachment).mockResolvedValue({ downloadUrl: 'https://files.test/plan?sig=1', fileName: 'plan.pdf' });
    renderList([attachment({ id: 'att-7' })]);

    await userEvent.click(screen.getByRole('button', { name: 'Download plan.pdf' }));

    expect(recordEmailService.downloadAttachment).toHaveBeenCalledWith(RECORD_ID, 'att-7');
    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(clicked[0].href).toBe('https://files.test/plan?sig=1');
    expect(clicked[0].download).toBe('plan.pdf');
    expect(clicked[0].target).toBe('_blank');
    expect(clicked[0].rel).toBe('noopener noreferrer');
  });

  it('disables the button while the link is being fetched, and frees it afterwards', async () => {
    let finish: (v: { downloadUrl: string; fileName: string }) => void = () => {};
    vi.mocked(recordEmailService.downloadAttachment).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderList([attachment()]);

    await userEvent.click(screen.getByRole('button', { name: 'Download plan.pdf' }));
    expect(screen.getByRole('button', { name: 'Download plan.pdf' })).toBeDisabled();

    finish({ downloadUrl: 'https://files.test/x', fileName: 'plan.pdf' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download plan.pdf' })).toBeEnabled());
  });

  it('tells the user when the download could not start, and follows no link', async () => {
    vi.mocked(recordEmailService.downloadAttachment).mockRejectedValue(new Error('This file was not kept.'));
    renderList([attachment()]);

    await userEvent.click(screen.getByRole('button', { name: 'Download plan.pdf' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't download plan.pdf: This file was not kept."));
    expect(clicked).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Download plan.pdf' })).toBeEnabled();
  });
});
