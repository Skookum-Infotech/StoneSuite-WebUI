// The Angle (3D) choice in the profile editor: one card per angle, the
// picture above its degree label. It shapes how the attached piece stands
// relative to its parent in the derived 3D geometry (90 upright, 180 flat,
// 270 dropped).

import { PROFILE_ANGLES } from '@/lib/drawing/attachedProfileTypes';
import type { ProfileAngle } from '@/types/drawing';
import { ProfileAngleIcon } from './ProfileAngleIcon';

export function ProfileAnglePicker({ value, onChange }: { value: ProfileAngle; onChange: (angle: ProfileAngle) => void }) {
  return (
    <div role="radiogroup" aria-label="Angle (3D)" className="flex flex-wrap gap-2">
      {PROFILE_ANGLES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          aria-label={label}
          onClick={() => onChange(id)}
          className="flex w-20 flex-col items-center gap-1 rounded-lg border border-stone-300 bg-white p-1.5 text-micro font-semibold text-ink outline-none hover:border-stone-500 focus-visible:ring-2 focus-visible:ring-brand/40 aria-checked:border-brand-dark aria-checked:bg-brand/10 aria-checked:text-ink-strong"
        >
          <ProfileAngleIcon angle={id} className="h-12 w-12 rounded bg-white" />
          <span className="text-center leading-tight">{label}</span>
        </button>
      ))}
    </div>
  );
}
