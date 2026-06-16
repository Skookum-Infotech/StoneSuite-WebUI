import { useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = { readonly key: string; readonly label: string };

type Props = {
  tabs: readonly Tab[];
  readOnly?: boolean;
};

/** Inline sub-tab panel rendered below form fields on detail pages. */
export function CrmSubTabsPanel({ tabs, readOnly = true }: Props) {
  const [active, setActive] = useState<string>(tabs[0]?.key ?? '');

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="flex border-b border-stone-100 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={cn(
              'px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors',
              active === tab.key
                ? 'border-stone-800 text-stone-800'
                : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-300',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-5 py-4">
        {active === 'transactions' && <TransactionsContent />}
        {active === 'audit' && <AuditContent />}
        {active === 'files' && <FilesContent readOnly={readOnly} />}
      </div>
    </div>
  );
}

/** Standalone editable files panel for use inside create/edit forms. */
export function EditableFilesPanel() {
  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-stone-100">
        <div className="w-1 h-4 rounded-full shrink-0 bg-teal-400" />
        <h3 className="text-xs font-semibold text-stone-700">Files</h3>
      </div>
      <div className="px-5 py-4">
        <FilesContent readOnly={false} />
      </div>
    </div>
  );
}

function TransactionsContent() {
  return (
    <p className="py-6 text-center text-xs text-stone-400 italic">No transactions yet.</p>
  );
}

function AuditContent() {
  return (
    <p className="py-6 text-center text-xs text-stone-400 italic">No audit events recorded yet.</p>
  );
}

function FilesContent({ readOnly }: { readOnly: boolean }) {
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    // TODO: wire to file upload service
  }

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors',
            dragging ? 'border-stone-400 bg-stone-50' : 'border-stone-200 bg-white',
          )}
        >
          <Upload className="mx-auto h-5 w-5 text-stone-300 mb-2" />
          <p className="text-xs font-medium text-stone-500 mb-1">Drop files here to upload</p>
          <p className="text-2xs text-stone-300 mb-3">or</p>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 hover:border-stone-300 transition-colors">
            <FileText className="size-3" />
            Browse Files
            <input type="file" multiple className="sr-only" />
          </label>
        </div>
      )}

      <p className="py-4 text-center text-xs text-stone-400 italic">No files uploaded yet.</p>
    </div>
  );
}
