import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DuplicateWarnings } from './DuplicateWarnings';
import { duplicateStatusText } from '@/lib/documentDuplicateStatus';
import type { ExtractionDuplicate } from '@/types/documentExtraction';

describe('duplicateStatusText', () => {
  it.each([
    ['used', 'Already used to create an order'],
    ['attached', 'Attached to an order'],
    ['ready', 'Waiting for review'],
    ['Draft', 'Draft'],
  ])('maps %s', (raw, text) => {
    expect(duplicateStatusText(raw)).toBe(text);
  });
});

describe('DuplicateWarnings', () => {
  it('shows human status text instead of the raw extraction status', () => {
    const dup = { kind: 'same_file', reason: 'This file was already uploaded', status: 'used' } as ExtractionDuplicate;
    render(<DuplicateWarnings duplicates={[dup]} onOpenExisting={() => {}} onCreateAnyway={() => {}} />);
    expect(screen.getByText('Already used to create an order')).toBeInTheDocument();
    expect(screen.queryByText('used')).not.toBeInTheDocument();
  });
});
