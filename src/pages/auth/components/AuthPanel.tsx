import type { ReactNode, SyntheticEvent } from 'react'
import { cn } from '@/lib/utils'

const LAYOUT = {
  // Login fits the viewport without scrolling, so it uses tighter spacing.
  login: {
    main: 'h-full py-2 md:py-6',
    width: 'max-w-sm sm:max-w-lg',
    eyebrow: 'mb-5 hidden md:flex',
    card: 'p-6 sm:p-10',
  },
  form: {
    main: 'min-h-screen md:min-h-0 md:h-full py-12',
    width: 'max-w-sm sm:max-w-md',
    eyebrow: 'mb-4 flex',
    card: 'p-7 sm:p-9',
  },
} as const

const DOT_GRID_SIZE = 4

// The light side of every sign-in screen: teal grid background, the
// "Workspace Portal" label and the white form card. Login, Forgot Password
// and Reset Password render their form as `children`.
export function AuthPanel({ children, layout = 'form' }: { children: ReactNode; layout?: keyof typeof LAYOUT }) {
  const l = LAYOUT[layout]
  return (
    <main className={cn('auth-panel relative flex w-full items-center justify-center overflow-hidden px-4 text-ink-strong sm:px-6 md:w-1/2 lg:px-10', l.main)}>
      <div className="auth-panel-grid pointer-events-none absolute inset-0" />

      {/* Concentric circles — top right */}
      <div className="pointer-events-none absolute right-0 top-0 overflow-hidden">
        <svg width="220" height="220" viewBox="0 0 220 220" fill="none" aria-hidden="true">
          <circle cx="220" cy="0" r="80" stroke="rgba(0,95,115,0.09)" strokeWidth="0.75" />
          <circle cx="220" cy="0" r="120" stroke="rgba(0,95,115,0.06)" strokeWidth="0.75" />
          <circle cx="220" cy="0" r="165" stroke="rgba(0,95,115,0.04)" strokeWidth="0.75" />
        </svg>
      </div>

      {/* Concentric circles — bottom left */}
      <div className="pointer-events-none absolute bottom-0 left-0 overflow-hidden">
        <svg width="160" height="160" viewBox="0 0 160 160" fill="none" aria-hidden="true">
          <circle cx="0" cy="160" r="60" stroke="rgba(0,95,115,0.07)" strokeWidth="0.75" />
          <circle cx="0" cy="160" r="100" stroke="rgba(0,95,115,0.04)" strokeWidth="0.75" />
        </svg>
      </div>

      {/* Dot cluster */}
      <div className="pointer-events-none absolute left-6 top-1/3 hidden md:block" aria-hidden="true">
        {Array.from({ length: DOT_GRID_SIZE }, (_, row) => (
          <div key={row} className="mb-2 flex gap-2">
            {Array.from({ length: DOT_GRID_SIZE }, (_, col) => (
              <div key={col} className="h-0.5 w-0.5 rounded-full bg-[#005f73]/25" />
            ))}
          </div>
        ))}
      </div>

      {/* Soft glow pools */}
      <div className="auth-glow-teal pointer-events-none absolute right-0 top-1/4 h-72 w-72 -translate-y-1/2 rounded-full blur-3xl" />
      <div className="auth-glow-lime pointer-events-none absolute -left-8 bottom-1/4 h-52 w-52 rounded-full blur-3xl" />

      <div className={cn('relative w-full', l.width)}>
        <div className={cn('items-center gap-3', l.eyebrow)}>
          <div className="auth-rule-in h-px flex-1" />
          <span className="type-portal">Workspace Portal</span>
          <div className="auth-rule-out h-px flex-1" />
        </div>

        <div className={cn('auth-card relative overflow-hidden rounded-3xl bg-white/80 backdrop-blur-xl', l.card)}>
          <div className="auth-card-shimmer absolute left-10 right-10 top-0 h-px" />
          <div className="absolute right-4 top-4 flex gap-1" aria-hidden="true">
            <div className="auth-card-dot-1 h-1.5 w-1.5 rounded-full" />
            <div className="auth-card-dot-2 h-1.5 w-1.5 rounded-full" />
          </div>
          {children}
        </div>
      </div>
    </main>
  )
}

const LOGO = {
  lg: { box: 'mb-2 h-12 w-28 sm:mb-5 sm:h-20 sm:w-40', img: 'h-16 sm:h-32' },
  md: { box: 'mb-5 h-10 w-20', img: 'h-24' },
} as const

// If the logo image fails to load, show a plain "S" mark in its place.
function showLogoFallback(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget
  img.classList.add('hidden')
  img.nextElementSibling?.classList.remove('hidden')
}

export function AuthLogo({ size = 'md' }: { size?: keyof typeof LOGO }) {
  return (
    <div className={cn('mx-auto flex items-center justify-center', LOGO[size].box)}>
      <img src="/logo-dark.png" alt="Stone Suite logo" className={cn('w-auto object-contain', LOGO[size].img)} onError={showLogoFallback} />
      <span className="hidden text-xl font-bold text-[#001219]" aria-hidden="true">S</span>
    </div>
  )
}
