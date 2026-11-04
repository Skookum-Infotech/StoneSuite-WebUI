import { useRef, type ChangeEvent } from 'react';
import { Loader2, Upload } from 'lucide-react';

export function DxfUploadButton({ onFiles, busy }: { onFiles: (files: File[]) => void; busy: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".dxf"
        aria-label="Choose DXF files"
        tabIndex={-1}
        onChange={onChange}
        className="sr-only"
      />
      <button
        type="button"
        aria-label="Upload DXF"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        {busy ? 'Uploading…' : 'Upload DXF'}
      </button>
    </>
  );
}
