// Caps a widget's list to a fixed number of rows and shows how many were
// left out, instead of letting a widget with lots of data grow taller than
// its row-mates and break the grid's alignment.
export function MoreHint({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return <p className="pt-2 text-2xs font-medium text-stone-400">+{count} {label}</p>;
}
