import { Checkbox } from '@/components/ui/checkbox';

/** One row's checkbox; `label` names the row for screen readers, e.g. "Select INV-1001". */
export function SelectRowCheckbox({
  checked, label, onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={label} />;
}

/**
 * The header checkbox: ticked when every row on the page is, a dash when only
 * some are. Toggling it picks (or lets go of) the rows on this page only.
 */
export function SelectAllCheckbox({
  selectedCount, pageCount, onToggle,
}: {
  selectedCount: number;
  pageCount: number;
  onToggle: () => void;
}) {
  const all = pageCount > 0 && selectedCount === pageCount;
  return (
    <Checkbox
      checked={all ? true : selectedCount > 0 ? 'indeterminate' : false}
      onCheckedChange={onToggle}
      disabled={pageCount === 0}
      aria-label="Select all on this page"
    />
  );
}
