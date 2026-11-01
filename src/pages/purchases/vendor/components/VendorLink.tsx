import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/** Route of a vendor's detail page; opens on Overview. */
function vendorPath(vendorId: string): string {
  return `/purchases/vendor/${encodeURIComponent(vendorId)}`;
}

/**
 * A vendor's name as a link to the vendor page, for purchase lists and
 * details. Renders an em dash when the document has no vendor.
 */
export function VendorLink({
  vendor, className,
}: {
  vendor: { id: string; name: string } | null | undefined;
  className?: string;
}) {
  if (!vendor?.id) return <>{vendor?.name || '—'}</>;
  return (
    <Link
      to={vendorPath(vendor.id)}
      aria-label={`View vendor ${vendor.name}`}
      className={cn(
        'rounded hover:text-accent-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {vendor.name}
    </Link>
  );
}
