// The three pictures in the Profile type editor's "Angle (3D)" picker: how the
// attached piece stands relative to its parent in 3D. Hand-authored artwork
// (not derived from a formula, unlike EdgeFinishIcon's polygons), inlined so
// nothing is fetched at runtime — same reasoning as EdgeFinishIcon.

import type { ProfileAngle } from '@/types/drawing';

function Angle90({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 941 941" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="940.338" height="940.338" rx="30.658" fill="white" />
      <path d="M563 464L572.5 275L45.5 305L56 562L344.5 746L916 592.5L920.5 561L563 464ZM344.5 746V706M56 562L71 543.5M45.5 305L60 307L71 543.5M563 464L71 543.5M920.5 561L344.5 706M344.5 706L71 543.5" stroke="black" strokeWidth="10" />
      <path d="M56 562L45.5 305L572.5 275L563 464L71 543.5L56 562Z" fill="#FFAF1F" />
      <path d="M56 562L45.5 305L572.5 275L563 464L71 543.5L56 562Z" fill="url(#profileAngle90Gradient)" />
      <path d="M71 543.5L563 464L572.5 275L45.5 305L56 562L71 543.5ZM45.5 305L60 307L71 543.5" stroke="black" />
      <path d="M563 464L920.5 561L916 592.5L344.5 746L56 562L71 543.5L563 464Z" fill="#414141" />
      <path d="M71 543.5L563 464L920.5 561L916 592.5L344.5 746L56 562L71 543.5ZM344.5 746V706M920.5 561L344.5 706M344.5 706L71 543.5" stroke="black" />
      <defs>
        <linearGradient id="profileAngle90Gradient" x1="280" y1="437" x2="297.231" y2="534.814" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFAF1F" stopOpacity="0" />
          <stop offset="1" stopColor="#AD6F00" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Angle180({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 941 941" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="940.338" height="940.338" rx="30.658" fill="white" />
      <path d="M593.5 444.064L924 500L921 527L434.5 652.5L161.5 531.387L22 469.5V449L407 412.5L593.5 444.064ZM22 449L162.5 504.689M434.5 612.5L924 500M434.5 612.5L162.5 504.689M434.5 612.5V652.5M593.5 444.064L162.5 504.689M162.5 504.689L161.5 531.387" stroke="black" strokeWidth="10" />
      <path d="M22 449L407 412.5L593.5 444.064L162.5 504.689L161.5 531.387L22 469.5V449Z" fill="#414141" />
      <path d="M162.5 504.689L161.5 531.387L22 469.5V449L407 412.5L593.5 444.064L162.5 504.689ZM22 449L162.5 504.689" stroke="black" />
      <path d="M593.5 444.064L924 500L921 527L434.5 652.5L161.5 531.387L162.5 504.689L593.5 444.064Z" fill="#FFAF1F" />
      <path d="M593.5 444.064L924 500L921 527L434.5 652.5L161.5 531.387L162.5 504.689L593.5 444.064Z" fill="url(#profileAngle180Gradient)" />
      <path d="M434.5 612.5L924 500M434.5 612.5L162.5 504.689M434.5 612.5V652.5M434.5 652.5L161.5 531.387L162.5 504.689L593.5 444.064L924 500L921 527L434.5 652.5Z" stroke="black" />
      <defs>
        <linearGradient id="profileAngle180Gradient" x1="465" y1="519" x2="451.991" y2="438.86" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFAF1F" stopOpacity="0" />
          <stop offset="1" stopColor="#AD6F00" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Angle270({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 941 941" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="940.338" height="940.338" rx="30.658" fill="white" />
      <path d="M387.5 469L36.5 385.5L34.5 352L521.5 303L899 338L876 586L422.5 802L392.5 786.5L387.5 469ZM387.5 469L420.5 430M422.5 802L420.5 430M420.5 430L34.5 352M420.5 430L899 338" stroke="black" strokeWidth="10" />
      <path d="M36.5 385.5L34.5 352L521.5 303L899 338L420.5 430L387.5 469L36.5 385.5Z" fill="#414141" />
      <path d="M420.5 430L34.5 352M34.5 352L36.5 385.5L387.5 469L420.5 430L899 338L521.5 303L34.5 352Z" stroke="black" />
      <path d="M392.5 786.5L387.5 469L420.5 430L899 338L876 586L422.5 802L392.5 786.5Z" fill="#FFAF1F" />
      <path d="M392.5 786.5L387.5 469L420.5 430L899 338L876 586L422.5 802L392.5 786.5Z" fill="url(#profileAngle270Gradient)" />
      <path d="M420.5 430L899 338L876 586L422.5 802L392.5 786.5L387.5 469L420.5 430ZM422.5 802L420.5 430" stroke="black" />
      <defs>
        <linearGradient id="profileAngle270Gradient" x1="602" y1="513" x2="566.503" y2="379.864" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFAF1F" stopOpacity="0" />
          <stop offset="1" stopColor="#AD6F00" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function ProfileAngleIcon({ angle, className }: { angle: ProfileAngle; className?: string }) {
  if (angle === 90) return <Angle90 className={className} />;
  if (angle === 270) return <Angle270 className={className} />;
  return <Angle180 className={className} />;
}
