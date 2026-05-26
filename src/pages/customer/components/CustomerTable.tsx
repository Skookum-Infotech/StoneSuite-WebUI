import type { Customer, CustomerStatus } from '../OnboardingPage';

type Props = {
  customers: Customer[];
};

const statusStyles: Record<CustomerStatus, string> = {
  Draft: 'bg-stone-100 text-stone-600',
  'Pending Setup': 'bg-amber-100 text-amber-700',
  'In Review': 'bg-blue-100 text-blue-700',
  Active: 'bg-green-100 text-green-700',
};

export function CustomerTable({ customers }: Props) {
  return (
    <div className="overflow-hidden border border-stone-200 bg-white rounded-md shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-brand/20 text-xs uppercase tracking-wide text-brand-dark">
          <tr>
            <th className="px-5 py-4 font-semibold">Company</th>
            <th className="px-5 py-4 font-semibold">Country</th>
            <th className="px-5 py-4 font-semibold">Currency</th>
            <th className="px-5 py-4 font-semibold">Super Admin</th>
            <th className="px-5 py-4 font-semibold">Status</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-stone-100">
          {customers.map((customer) => (
            <tr key={customer.id} className="hover:bg-stone-50/70">
              <td className="px-5 py-4">
                <div className="font-semibold text-stone-900">
                  {customer.companyName}
                </div>
                <div className="text-xs text-stone-500">
                  {customer.legalName}
                </div>
              </td>

              <td className="px-5 py-4 text-stone-600">{customer.country}</td>
              <td className="px-5 py-4 text-stone-600">{customer.currency}</td>

              <td className="px-5 py-4">
                <div className="font-medium text-stone-800">
                  {customer.superAdminName}
                </div>
                <div className="text-xs text-stone-500">
                  {customer.superAdminEmail}
                </div>
              </td>

              <td className="px-5 py-4">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[customer.status]}`}
                >
                  {customer.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {customers.length === 0 && (
        <div className="flex h-40 items-center justify-center text-sm text-stone-400">
          No customers added yet.
        </div>
      )}
    </div>
  );
}