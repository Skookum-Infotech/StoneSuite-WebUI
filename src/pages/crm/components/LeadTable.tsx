import type { Lead } from '@/types/lead';

type Props = {
  leads: Lead[];
  isLoading?: boolean;
};

const statusStyles: Record<string, string> = {
  'LEAD-Unqualified': 'bg-stone-100 text-stone-600',
  'LEAD-Qualified': 'bg-blue-100 text-blue-700',
  'LEAD-New': 'bg-purple-100 text-purple-700',
  'LEAD-In Progress': 'bg-amber-100 text-amber-700',
  'LEAD-Converted': 'bg-green-100 text-green-700',
  'LEAD-Dead': 'bg-red-100 text-red-600',
};

export function LeadTable({ leads, isLoading }: Props) {
  return (
    <div className="overflow-hidden border border-stone-200 bg-white rounded-md shadow-sm">
      <table className="w-full text-left text-xs">
        <thead className="bg-brand/20 text-2xs uppercase tracking-wide text-brand-dark">
          <tr>
            <th className="px-3 py-2.5 font-semibold">Lead ID</th>
            <th className="px-3 py-2.5 font-semibold">Name / Company</th>
            <th className="px-3 py-2.5 font-semibold">Type</th>
            <th className="px-3 py-2.5 font-semibold">Email</th>
            <th className="px-3 py-2.5 font-semibold">Phone</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-stone-100">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-stone-50/70">
              <td className="px-3 py-2 text-stone-500 font-mono">{lead.leadId || '—'}</td>
              <td className="px-3 py-2">
                <div className="font-semibold text-stone-900">
                  {lead.type === 'Individual'
                    ? [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '—'
                    : lead.companyName || '—'}
                </div>
                {lead.type === 'Individual' && lead.companyName && (
                  <div className="text-2xs text-stone-400">{lead.companyName}</div>
                )}
              </td>
              <td className="px-3 py-2 text-stone-600">{lead.type}</td>
              <td className="px-3 py-2 text-stone-600">{lead.email || '—'}</td>
              <td className="px-3 py-2 text-stone-600">{lead.phone || '—'}</td>
              <td className="px-3 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${statusStyles[lead.leadStatus] ?? 'bg-stone-100 text-stone-600'}`}
                >
                  {lead.leadStatus}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isLoading && (
        <div className="flex h-32 items-center justify-center text-xs text-stone-400">
          Loading leads…
        </div>
      )}

      {!isLoading && leads.length === 0 && (
        <div className="flex h-32 items-center justify-center text-xs text-stone-400">
          No leads added yet.
        </div>
      )}
    </div>
  );
}
