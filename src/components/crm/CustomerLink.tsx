import { Link } from 'react-router-dom';
import { useUserPermissions } from '@/hooks/useUserPermissions';

interface CustomerLinkProps {
  /** The customer's record id (uuid); without one the name renders as text. */
  id?: string | null;
  name: string;
  className?: string;
}

/**
 * A customer's name that opens the customer page — but only when the viewer may
 * read customers and the id is known; otherwise plain text. Safe to drop inside
 * a clickable row: the click does not bubble to the row.
 */
export function CustomerLink({ id, name, className }: CustomerLinkProps) {
  const { hasPermission } = useUserPermissions();
  if (!id || !hasPermission('customer', 'read')) return <span className={className}>{name}</span>;
  return (
    <Link
      to={`/crm/customer/${encodeURIComponent(id)}`}
      onClick={(e) => e.stopPropagation()}
      aria-label={`View customer ${name}`}
      className={className}
    >
      {name}
    </Link>
  );
}
