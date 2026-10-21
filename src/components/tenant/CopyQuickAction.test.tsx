import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CopyQuickAction } from './CopyQuickAction';

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{`${loc.pathname}${loc.search}`}</p>;
}

describe('CopyQuickAction', () => {
  it('opens the Add page with the source id and a labelled button', async () => {
    render(
      <MemoryRouter initialEntries={['/sales/sales_order/so-1']}>
        <Routes>
          <Route
            path="/sales/sales_order/:id"
            element={<CopyQuickAction recordLabel="sales order" addPath="/sales/sales_order/new" sourceId="so-1" />}
          />
          <Route path="/sales/sales_order/new" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Copy sales order' }));

    expect(screen.getByTestId('where')).toHaveTextContent('/sales/sales_order/new?copyFrom=so-1');
  });
});
