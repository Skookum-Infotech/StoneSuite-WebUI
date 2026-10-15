import { CreatedOrderForm } from './components/CreatedOrderForm';

// Place a new countertop order. The form itself is shared with the page that
// changes one, so the two can never drift apart.
export default function AddCreatedOrderPage() {
  return <CreatedOrderForm />;
}
