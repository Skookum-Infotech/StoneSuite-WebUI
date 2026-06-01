import type { Customer } from '@/types/customer';

type Props = {
  customers: Customer[];
  isLoading?: boolean;
};

const statusStyles: Record<string, string> = {
  draft: 'bg-stone-100 text-stone-600',
  invitation_sent: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-600',
};

const statusLabel: Record<string, string> = {
  draft: 'Draft',
  invitation_sent: 'Invitation Sent',
  active: 'Active',
  suspended: 'Suspended',
};

export function CustomerTable({ customers, isLoading }: Props) {
  const superAdmin = (customer: Customer) =>
    customer.contacts?.find((c) => c.role === 'super_admin');

  return (
    <div className="overflow-hidden border border-stone-200 bg-white rounded-md shadow-sm">
      <table className="w-full text-left text-xs">
        <thead className="bg-brand/20 text-[10px] uppercase tracking-wide text-brand-dark">
          <tr>
            <th className="px-3 py-2.5 font-semibold">Company</th>
            <th className="px-3 py-2.5 font-semibold">Country</th>
            <th className="px-3 py-2.5 font-semibold">Currency</th>
            <th className="px-3 py-2.5 font-semibold">Super Admin</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-stone-100">
          {customers.map((customer) => {
            const admin = superAdmin(customer);
            return (
              <tr key={customer.id} className="hover:bg-stone-50/70">
                <td className="px-3 py-2">
                  <div className="font-semibold text-stone-900">{customer.name}</div>
                  {customer.legalName && (
                    <div className="text-[10px] text-stone-400">{customer.legalName}</div>
                  )}
                </td>

                <td className="px-3 py-2 text-stone-600">{customer.country || '—'}</td>
                <td className="px-3 py-2 text-stone-600">{customer.currency || '—'}</td>

                <td className="px-3 py-2">
                  {admin ? (
                    <>
                      <div className="font-medium text-stone-800">{admin.fullName}</div>
                      <div className="text-[10px] text-stone-400">{admin.email}</div>
                    </>
                  ) : (
                    <span className="text-stone-300">—</span>
                  )}
                </td>

                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyles[customer.status] ?? 'bg-stone-100 text-stone-600'}`}
                  >
                    {statusLabel[customer.status] ?? customer.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {isLoading && (
        <div className="flex h-32 items-center justify-center text-xs text-stone-400">
          Loading customers…
        </div>
      )}

      {!isLoading && customers.length === 0 && (
        <div className="flex h-32 items-center justify-center text-xs text-stone-400">
          No customers added yet.
        </div>
      )}
    </div>
  );
}
