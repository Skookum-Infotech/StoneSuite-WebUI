import { useRef, type ChangeEvent } from 'react';
import { Loader2, Upload } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
        className={cn(buttonVariants({ variant: 'outline' }), 'shrink-0')}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        {busy ? 'Uploading…' : 'Upload DXF'}
      </button>
    </>
  );
}
