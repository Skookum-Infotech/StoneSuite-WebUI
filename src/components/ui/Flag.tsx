import { useState } from 'react';
import { cn } from '@/lib/utils';
import { countryFlagCode, stateFlagUrl, type OptionFlag } from '@/lib/flags';

// 3:2 box shared by country and state flags so rows stay aligned in a list.
const FLAG_BOX_CLS = 'inline-block h-3.5 w-5 shrink-0 rounded-[2px] border border-stone-200 bg-stone-100 object-cover';
const FLAG_FILE_RE = /\/([a-z]{2})\.svg$/;
// flag-icons' "unknown country" placeholder — never worth showing.
const UNKNOWN_FLAG_CODE = 'xx';

// Every country flag shipped by `flag-icons`, keyed by alpha-2. Bundled as
// hashed asset URLs (fetched only when an <img> uses one), and doubling as the
// allow-list: a code with no file renders no flag instead of an empty box.
const COUNTRY_FLAG_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('/node_modules/flag-icons/flags/4x3/*.svg', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).flatMap(([path, url]) => {
    const code = FLAG_FILE_RE.exec(path)?.[1];
    return code && code !== UNKNOWN_FLAG_CODE ? [[code, url] as const] : [];
  }),
);

// `reserveSpace` keeps list rows aligned when a code has no flag file.
export function Flag({ kind, code, reserveSpace = false }: OptionFlag & { reserveSpace?: boolean }) {
  const [failed, setFailed] = useState(false);

  const alpha2 = kind === 'country' ? countryFlagCode(code) : null;
  const url = kind === 'country' ? (alpha2 ? COUNTRY_FLAG_URLS[alpha2] : undefined) : stateFlagUrl(code);
  if (!url || failed) return reserveSpace ? <span aria-hidden="true" className="inline-block h-3.5 w-5 shrink-0" /> : null;

  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn(FLAG_BOX_CLS)}
      data-flag-kind={kind}
      data-flag-code={kind === 'country' ? alpha2 : code.toUpperCase()}
    />
  );
}
