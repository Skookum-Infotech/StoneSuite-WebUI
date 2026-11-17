export function DxfNotShownNote({ unsupported }: { unsupported: Record<string, number> }) {
  const notShown = Object.entries(unsupported).map(([type, count]) => `${count} ${type}`).join(', ');
  if (!notShown) return null;
  return <p className="mt-2 type-helper">Not shown in this preview: {notShown}. Download the file to see everything.</p>;
}
