import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface AuthHeroCopy {
  /** Small pill above the headline, e.g. "Next-Gen Platform". */
  badge: string
  /** Headline first line, in white. */
  lead: string
  /** Headline second line, in the lime gradient. */
  accent: string
  description: string
}

export interface AuthHeroFeature {
  icon: ReactNode
  title: string
  text: string
}

const COMET_CLASSES = ['auth-comet-1', 'auth-comet-2', 'auth-comet-3', 'auth-comet-4', 'auth-comet-5', 'auth-comet-6', 'auth-comet-7']
const SPOT_CLASSES = ['auth-spot-1', 'auth-spot-2', 'auth-spot-3']
const BEACON_CLASSES = ['auth-beacon-1', 'auth-beacon-2', 'auth-beacon-3']
const FEATURE_GRID: Record<number, string> = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }

const SOCIAL_ICON_CLS =
  'flex h-7 w-7 lg:h-8 lg:w-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40 transition-colors hover:bg-white/10 hover:text-white'

// The decorative dark panel beside every sign-in form (Login, Forgot
// Password, Reset Password). Purely presentational: each page passes its own
// wording and feature cards; the look, motion and layout live here and in
// styles/auth.css, so the three screens can no longer drift apart.
export function AuthHero({ copy, features, showSocial = false }: {
  copy: AuthHeroCopy
  features: AuthHeroFeature[]
  showSocial?: boolean
}) {
  return (
    <aside className="bg-header relative hidden h-screen w-1/2 flex-col overflow-hidden md:flex">
      <div className="auth-glow-pulse-slow absolute -left-40 -top-40 h-[500px] w-[500px] animate-pulse rounded-full bg-[#005f73]/25 blur-[120px]" />
      <div className="auth-glow-pulse-slower absolute -bottom-40 -right-40 h-[500px] w-[500px] animate-pulse rounded-full bg-brand/10 blur-[120px]" />
      <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 animate-[spin_40s_linear_infinite] rounded-full bg-gradient-to-r from-transparent via-[#005f73]/10 to-transparent blur-3xl" />
      <div className="auth-hero-dots absolute inset-0 opacity-[0.2]" />

      {/* Rotating gem */}
      <div className="auth-float absolute bottom-1/3 left-10">
        <div className="auth-spin">
          <svg width="58" height="58" viewBox="0 0 58 58" fill="none" aria-hidden="true">
            <polygon points="29,2 54,15.5 54,42.5 29,56 4,42.5 4,15.5" stroke="rgba(163,230,53,0.28)" strokeWidth="1" fill="rgba(163,230,53,0.07)" />
            <polygon points="29,12 44,20.5 44,37.5 29,46 14,37.5 14,20.5" stroke="rgba(163,230,53,0.15)" strokeWidth="0.75" fill="rgba(163,230,53,0.04)" />
            <circle cx="29" cy="29" r="3" fill="rgba(163,230,53,0.45)" />
          </svg>
        </div>
      </div>

      {/* Shooting star comets */}
      {COMET_CLASSES.map((cls) => <div key={cls} className={cn('auth-comet', cls)} aria-hidden="true" />)}

      <div className="relative z-10 flex h-full flex-col justify-between p-8 lg:p-12">
        <div className="flex items-center gap-3" aria-hidden="true">
          {BEACON_CLASSES.map((cls) => <span key={cls} className={cn('auth-beacon h-1.5 w-1.5 rounded-full', cls)} />)}
          <div className="auth-hairline h-px flex-1" />
        </div>

        <div className="max-w-xl">
          <div className="mb-4 inline-flex transform items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 lg:px-4 lg:py-2 transition-all hover:-translate-y-1 hover:bg-brand/20">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
            </span>
            <span className="text-micro lg:text-caption font-semibold uppercase tracking-widest text-brand">{copy.badge}</span>
          </div>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white md:text-4xl lg:text-5xl">
            {copy.lead} <br />
            <span className="bg-gradient-to-r from-brand via-brand-hover to-brand-dark bg-clip-text text-transparent">{copy.accent}</span>
          </h1>
          <p className="mt-4 max-w-lg text-body lg:text-base leading-relaxed text-white/60">{copy.description}</p>
          <div className={cn('mt-6 grid gap-3 lg:mt-8', FEATURE_GRID[features.length])}>
            {features.map((f, i) => (
              <div
                key={f.title}
                className={cn(
                  'group cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-3 lg:p-4 backdrop-blur-sm transition-colors duration-500 hover:bg-white/10',
                  SPOT_CLASSES[i % SPOT_CLASSES.length],
                )}
              >
                <div className="mb-2 inline-flex rounded-lg bg-brand/20 p-1.5 text-brand transition-transform group-hover:scale-110 group-hover:bg-brand/30">
                  {f.icon}
                </div>
                <h3 className="text-caption font-semibold text-white">{f.title}</h3>
                <p className="mt-1 text-micro leading-relaxed text-white/40">{f.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-4 lg:pt-6">
          <p className="text-micro lg:text-caption font-medium uppercase tracking-widest text-white/30">
            © {new Date().getFullYear()} Stone Suite
          </p>
          {showSocial && (
            <div className="flex items-center gap-2 lg:gap-3">
              <span className={SOCIAL_ICON_CLS}>
                <svg className="size-3 lg:size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" /></svg>
              </span>
              <span className={SOCIAL_ICON_CLS}>
                <svg className="size-3 lg:size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
