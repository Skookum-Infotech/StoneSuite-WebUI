import { useNavigate } from 'react-router-dom';
import { Upload, Pencil, FileDown, Loader2 } from 'lucide-react';

interface Props {
  jobId: string;
  canEdit: boolean;
  exporting: boolean;
  error?: string;
  onExport: () => void;
}

/** Sidebar "Quick Actions" card: upload, edit and PDF export. */
export function FabricationQuickActionsCard({ jobId, canEdit, exporting, error, onExport }: Props) {
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
      <p className="type-card-title">Quick Actions</p>
      <div className="space-y-0.5">
        <button
          type="button"
          onClick={() => navigate(`/sales/installation/${jobId}/edit`, { state: { initialTab: 'files' } })}
          className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-button text-ink w-full transition-colors text-left"
        >
          <Upload className="size-4 text-ink-faint shrink-0" />
          Upload file
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={() => navigate(`/sales/installation/${jobId}/edit`)}
            className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-button text-ink w-full transition-colors text-left"
          >
            <Pencil className="size-4 text-ink-faint shrink-0" />
            Edit fabrication job
          </button>
        )}
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-button text-ink w-full transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="Export as PDF"
        >
          {exporting ? <Loader2 className="size-4 text-ink-faint shrink-0 animate-spin" /> : <FileDown className="size-4 text-ink-faint shrink-0" />}
          {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>
      {error && (
        <p role="alert" className="type-error">{error}</p>
      )}
    </div>
  );
}
