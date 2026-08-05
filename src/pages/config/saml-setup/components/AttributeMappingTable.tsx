interface AttributeMappingRow {
  name: string;
  value: string;
}

interface AttributeMappingTableProps {
  nameHeader: string;
  valueHeader: string;
  rows: AttributeMappingRow[];
}

export function AttributeMappingTable({ nameHeader, valueHeader, rows }: AttributeMappingTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-stone-200">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="bg-stone-50 text-2xs font-semibold uppercase tracking-wide text-stone-400">
            <th scope="col" className="px-3 py-2 font-semibold">
              {nameHeader}
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              {valueHeader}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.name} className={idx === rows.length - 1 ? "" : "border-b border-stone-100"}>
              <td className="px-3 py-2">
                <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-2xs font-semibold text-stone-700">
                  {row.name}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-2xs text-stone-600">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
