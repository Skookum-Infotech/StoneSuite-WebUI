import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { toast } from 'sonner';
import { UploadDocumentButton } from './UploadDocumentButton';
import { MAX_DOCUMENT_UPLOAD_BYTES } from '@/lib/documentUploadValidation';

const BUTTON_NAME = 'Upload Sales Order file';

function renderButton(props: Partial<ComponentProps<typeof UploadDocumentButton>> = {}) {
  const onFileSelected = vi.fn();
  const { container } = render(
    <UploadDocumentButton documentLabel="Sales Order" onFileSelected={onFileSelected} {...props} />,
  );
  const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
  return { onFileSelected, fileInput };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UploadDocumentButton', () => {
  it('renders an accessible "Upload <document>" button', () => {
    renderButton();

    expect(screen.getByRole('button', { name: BUTTON_NAME })).toBeInTheDocument();
    expect(screen.getByText('Upload Sales Order')).toBeInTheDocument();
  });

  it('opens the system file picker when clicked', async () => {
    const user = userEvent.setup();
    const { fileInput } = renderButton();
    const openPicker = vi.spyOn(fileInput, 'click');

    await user.click(screen.getByRole('button', { name: BUTTON_NAME }));

    expect(openPicker).toHaveBeenCalledTimes(1);
  });

  it('hands a valid file to onFileSelected', async () => {
    const user = userEvent.setup();
    const { onFileSelected, fileInput } = renderButton();
    const file = new File(['%PDF'], 'so-1001.pdf', { type: 'application/pdf' });

    await user.upload(fileInput, file);

    expect(onFileSelected).toHaveBeenCalledTimes(1);
    expect(onFileSelected).toHaveBeenCalledWith(file);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('rejects an unsupported file type with an error toast and does not call onFileSelected', async () => {
    // applyAccept: false — the input's accept attribute already keeps a real
    // OS picker to PDF/PNG/JPG, but a picker can still be switched to "All
    // files"; this simulates that bypass so validateDocumentFile is exercised
    // as the defense-in-depth it's for.
    const user = userEvent.setup({ applyAccept: false });
    const { onFileSelected, fileInput } = renderButton();

    await user.upload(fileInput, new File(['a,b'], 'sheet.csv', { type: 'text/csv' }));

    expect(onFileSelected).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      `"sheet.csv" isn't a supported file type — upload a PDF, PNG, or JPG.`,
    );
  });

  it('rejects an oversized file with an error toast and does not call onFileSelected', async () => {
    const user = userEvent.setup();
    const { onFileSelected, fileInput } = renderButton();
    const oversized = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversized, 'size', { value: MAX_DOCUMENT_UPLOAD_BYTES + 1 });

    await user.upload(fileInput, oversized);

    expect(onFileSelected).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('"big.pdf" is larger than the 25 MB limit.');
  });

  it('lets the same file be picked twice in a row', async () => {
    const user = userEvent.setup();
    const { onFileSelected, fileInput } = renderButton();
    const file = new File(['%PDF'], 'so-1001.pdf', { type: 'application/pdf' });

    await user.upload(fileInput, file);
    await user.upload(fileInput, file);

    expect(onFileSelected).toHaveBeenCalledTimes(2);
  });

  it('disables the button when disabled', () => {
    renderButton({ disabled: true });

    expect(screen.getByRole('button', { name: BUTTON_NAME })).toBeDisabled();
  });
});
