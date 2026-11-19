// The two pictures in the Profile type editor's "Finish (3D)" picker: whether
// two painted sides meeting at a piece's corner get a plain or mitered joint.
// Hand-authored artwork, inlined so nothing is fetched at runtime — same
// reasoning as EdgeFinishIcon / ProfileAngleIcon.

import type { ProfileFinish } from '@/types/drawing';

function FinishNone({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
      <polygon points="8,32 88,32 88,68 8,68" fill="#212529" />
    </svg>
  );
}

function FinishMitered({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
      <polygon points="8,18 88,18 88,78 60,78 60,46 8,46" fill="#212529" />
      <line x1="60" y1="46" x2="88" y2="18" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

export function ProfileFinishIcon({ finish, className }: { finish: ProfileFinish; className?: string }) {
  return finish === 'mitered' ? <FinishMitered className={className} /> : <FinishNone className={className} />;
}
