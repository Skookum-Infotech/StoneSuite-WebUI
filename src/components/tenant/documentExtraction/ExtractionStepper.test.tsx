import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExtractionStepper } from './ExtractionStepper';

describe('ExtractionStepper', () => {
  it('marks the current step, pairs every step with text and announces it politely', () => {
    render(<ExtractionStepper stage="reading" failedAt={null} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Read');
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getAllByText('Waiting')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('Step 2 of 4: Read, in progress');
  });

  it('shows Failed text on the failing step', () => {
    render(<ExtractionStepper stage="failed" failedAt="upload" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Step 1 of 4: Upload, failed');
  });
});
