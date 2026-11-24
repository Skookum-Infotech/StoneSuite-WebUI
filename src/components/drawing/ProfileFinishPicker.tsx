// The Finish (3D) choice in the profile editor: one card per finish, the
// picture above its name. It shapes the mitered/square joint where two
// painted sides meet at a corner in the derived 2D/3D geometry.

import { PROFILE_FINISHES } from '@/lib/drawing/attachedProfileTypes';
import type { ProfileFinish } from '@/types/drawing';
import { ProfileFinishIcon } from './ProfileFinishIcon';

export function ProfileFinishPicker({ value, onChange }: { value: ProfileFinish; onChange: (finish: ProfileFinish) => void }) {
  return (
    <div role="radiogroup" aria-label="Finish (3D)" className="flex flex-wrap gap-2">
      {PROFILE_FINISHES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          aria-label={label}
          onClick={() => onChange(id)}
          className="flex w-20 flex-col items-center gap-1 rounded-lg border border-stone-300 bg-white p-1.5 text-micro font-semibold text-ink outline-none hover:border-stone-500 focus-visible:ring-2 focus-visible:ring-brand/40 aria-checked:border-brand-dark aria-checked:bg-brand/10 aria-checked:text-ink-strong"
        >
          <ProfileFinishIcon finish={id} className="h-12 w-12 rounded bg-white" />
          <span className="text-center leading-tight">{label}</span>
        </button>
      ))}
    </div>
  );
}
