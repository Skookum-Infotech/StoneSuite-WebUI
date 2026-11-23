import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FabricationTemplateReview } from './FabricationTemplateReview';
import type { TemplateRevision } from '@/types/fabricationTemplates';
const revision: TemplateRevision = { jobVersion: 1, id: 'revision', revision: 2, salesOrderVersion: 3, state: 'submitted', baseline: [], lines: [{ sourceLineId: 'line', materialId: 'stone', quantity: 10, unitPrice: 25, scope: 'Kitchen countertop', pieces: [{ name: 'Island', lengthMm: 2000, widthMm: 900, thicknessMm: 30 }] }], change: { internalRequired: true, customerRequired: true, changedLines: ['line'] }, createdAt: '2026-10-01T12:00:00Z' };
describe('FabricationTemplateReview', () => {
 it('shows finish changes alongside the previously ordered finish', () => {
  const line = revision.lines[0];
  render(<FabricationTemplateReview revision={{ ...revision, baseline: [{ ...line, finish: 'Polished' }], lines: [{ ...line, finish: 'Honed' }] }} />);
  expect(screen.getByText('Required finish')).toBeVisible();
  expect(screen.getByText('Honed')).toBeVisible();
  expect(screen.getByText('Previously Polished')).toBeVisible();
 });
 it('makes missing finish requirements visible for layout review', () => {
  render(<FabricationTemplateReview revision={revision} />);
  expect(screen.getByText('Confirm during layout review')).toBeVisible();
 });
 it('shows the exact revision and both required approvals without claiming approval', () => {
  render(<FabricationTemplateReview revision={revision} />);
  expect(screen.getByText('Revision 2')).toBeVisible();
  expect(screen.getByText('Customer approval required')).toBeVisible();
  expect(screen.getByText('Internal review required')).toBeVisible();
  expect(screen.getByText('Island')).toBeVisible();
  expect(screen.getByText('2000 × 900 × 30 mm')).toBeVisible();
 });
 it('does not ask for customer approval on measurement-only changes', () => {
  render(<FabricationTemplateReview revision={{ ...revision, change: { ...revision.change, customerRequired: false } }} />);
  expect(screen.queryByText('Customer approval required')).not.toBeInTheDocument();
 });
});
