import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FabricationMaterialCard } from './FabricationMaterialCard';
import type { FabricationMaterial } from '@/types/fabrication';

const mat = (over: Partial<FabricationMaterial> = {}): FabricationMaterial => ({
  itemId: 'i1', sku: 'GRAN-001', name: 'Absolute Black', unitCode: 'SQFT',
  ordered: 60, needed: 32.292, basis: 'blueprint', pieceCount: 1,
  allocated: 0, consumed: 0, inStock: 90.416, shortfall: 32.292, ...over,
});

describe('FabricationMaterialCard', () => {
  it('shows what was ordered, what the blueprint needs, what is allocated and what is in stock', () => {
    render(<FabricationMaterialCard material={mat({ allocated: 10, shortfall: 22.292 })} />);

    const card = screen.getByRole('region', { name: 'Absolute Black material' });
    expect(card).toHaveTextContent('GRAN-001');
    expect(card).toHaveTextContent('Ordered60 sq ft');
    expect(card).toHaveTextContent('Needed32.292 sq ft');
    expect(card).toHaveTextContent('Blueprint · 1 piece');
    expect(card).toHaveTextContent('Allocated10 sq ft');
    expect(card).toHaveTextContent('In stock90.416 sq ft');
  });

  it('says how far short it is while more can be allocated from stock', () => {
    render(<FabricationMaterialCard material={mat()} />);

    expect(screen.getByText('Short by 32.292 sq ft')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says it is covered once nothing more is needed', () => {
    render(<FabricationMaterialCard material={mat({ allocated: 45.208, shortfall: 0 })} />);

    expect(screen.getByText('Covered')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '100% of what is needed is allocated' })).toBeInTheDocument();
  });

  it('warns when stock cannot cover the gap, and by how much', () => {
    render(<FabricationMaterialCard material={mat({ shortfall: 50, inStock: 45.208 })} />);

    expect(screen.getByText('Not enough in stock')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Only 45.208 sq ft is in stock, 4.792 sq ft short');
  });

  it('explains that the need is only the ordered quantity until pieces are drawn', () => {
    render(<FabricationMaterialCard material={mat({ basis: 'order', pieceCount: 0, needed: 60, shortfall: 60 })} />);

    expect(screen.getByText('Ordered quantity — no pieces drawn yet')).toBeInTheDocument();
    expect(screen.getByText(/once the blueprint is entered/i)).toBeInTheDocument();
  });

  it('notes how much has already been cut', () => {
    render(<FabricationMaterialCard material={mat({ allocated: 45.208, consumed: 45.208, shortfall: 0 })} />);

    expect(screen.getByText('45.208 sq ft already cut')).toBeInTheDocument();
  });

  it('offers to allocate when the user can', async () => {
    const onAllocate = vi.fn();
    render(<FabricationMaterialCard material={mat()} onAllocate={onAllocate} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Allocate slabs of Absolute Black' }));

    expect(onAllocate).toHaveBeenCalledTimes(1);
  });

  it('offers a requisition only when stock itself falls short', async () => {
    const onRestock = vi.fn();
    const { rerender } = render(<FabricationMaterialCard material={mat()} onRestock={onRestock} />);
    expect(screen.queryByRole('button', { name: /create a requisition/i })).not.toBeInTheDocument();

    rerender(<FabricationMaterialCard material={mat({ shortfall: 50, inStock: 45.208 })} onRestock={onRestock} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create a requisition for Absolute Black' }));

    expect(onRestock).toHaveBeenCalledTimes(1);
  });

  it('offers no actions to a user who can do neither', () => {
    render(<FabricationMaterialCard material={mat({ shortfall: 50, inStock: 45.208 })} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
