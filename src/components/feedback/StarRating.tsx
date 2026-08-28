import { useState } from 'react';
import { Star } from 'lucide-react';
import { MAX_RATING } from '@/lib/feedback';
import { cn } from '@/lib/utils';

// A 1-5 star input, optional (value is null until the reporter picks one).
// Keyboard-navigable as a radio group — arrow keys move the rating, Home/End
// jump to the ends — since a row of clickable icons has no native semantics
// of its own.
export function StarRating({ value, onChange }: { value: number | null; onChange: (rating: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value ?? 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const current = value ?? 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(MAX_RATING, current + 1 || 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(1, current - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(1);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(MAX_RATING);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Rate your experience"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded-lg p-1 -m-1"
    >
      {Array.from({ length: MAX_RATING }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          className="cursor-pointer transition-transform hover:scale-110"
        >
          <Star
            className={cn(
              'size-6 transition-colors',
              star <= display ? 'fill-amber-400 text-amber-400' : 'fill-none text-stone-300 dark:text-stone-600',
            )}
          />
        </button>
      ))}
    </div>
  );
}
