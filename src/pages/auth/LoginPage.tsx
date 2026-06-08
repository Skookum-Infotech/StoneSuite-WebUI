import { type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, Lock, Mail, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/useAuthStore'
import { apiErrorMessage } from '@/api/tenantClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FaAws } from 'react-icons/fa'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type LoginFields = z.infer<typeof loginSchema>

function OAuthButton({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full justify-center gap-2 rounded-xl border-stone-200 bg-white px-2 text-stone-700 shadow-sm transition-all duration-200 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950 focus-visible:ring-stone-400/20"
    >
      <span className="flex size-5 shrink-0 items-center justify-center">{icon}</span>
      <span className="truncate text-xs font-semibold sm:text-sm">{label}</span>
    </Button>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFields>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginFields) => {
    try {
      const response = await authService.login({ email: data.email, password: data.password, rememberMe: false })
      if (response.success && response.user && response.token) {
        setAuth(response.user, response.token)
        navigate('/dashboard')
      } else {
        setError('root', { message: response.message ?? 'Login failed' })
      }
    } catch (err: unknown) {
      setError('root', { message: apiErrorMessage(err, 'An error occurred during login') })
    }
  }

  return (
    <div
      className="min-h-screen md:h-screen md:overflow-hidden md:flex md:flex-row"
      style={{ fontFamily: "'DM Sans', 'Geist', system-ui, sans-serif" }}
    >
      {/* ── LEFT — Login ── */}
      <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden md:min-h-0 md:h-full bg-stone-50 px-4 py-12 text-stone-950 sm:px-6 md:w-1/2 lg:px-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-amber-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-stone-200/80 blur-3xl" />

        <div className="relative w-full max-w-sm sm:max-w-md">
          <div className="rounded-3xl border border-stone-200/80 bg-white/80 p-7 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.15),0_0_0_1px_rgba(255,255,255,0.9)_inset] backdrop-blur-sm sm:p-9">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-10 w-20 items-center justify-center">
                <img
                  src="/logo-dark.png"
                  alt="Stone Suite logo"
                  className="h-24 w-auto object-contain"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                    const parent = e.currentTarget.parentElement
                    if (parent) parent.innerHTML = '<span style="color:white;font-size:1.25rem;font-weight:700">S</span>'
                  }}
                />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-stone-950">Welcome back</h2>
              <p className="mt-2 text-sm text-stone-500">Sign in to your Stone Suite workspace</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-widest text-stone-500">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    {...register('email')}
                    className="h-11 rounded-xl border-stone-200 bg-stone-50/80 pl-10 text-stone-950 placeholder:text-stone-400 focus-visible:border-stone-400 focus-visible:bg-white focus-visible:ring-stone-300/40 transition-colors duration-150"
                  />
                </div>
                {errors.email && <p id="email-error" className="text-xs text-red-500">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-widest text-stone-500">
                    Password
                  </Label>
                  <a href="#" className="text-xs font-medium text-stone-400 hover:text-stone-700 transition-colors duration-150">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    {...register('password')}
                    className="h-11 rounded-xl border-stone-200 bg-stone-50/80 pl-10 text-stone-950 placeholder:text-stone-400 focus-visible:border-stone-400 focus-visible:bg-white focus-visible:ring-stone-300/40 transition-colors duration-150"
                  />
                </div>
                {errors.password && <p id="password-error" className="text-xs text-red-500">{errors.password.message}</p>}
              </div>

              {errors.root && (
                <div className="text-sm font-medium text-red-500 bg-red-50 p-2 rounded-md border border-red-100">
                  {errors.root.message}
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 h-11 w-full rounded-xl bg-brand text-sm font-semibold text-stone-950 transition-all duration-200 hover:bg-brand-hover active:scale-[0.99] focus-visible:ring-stone-400/30 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <><Loader2 className="mr-2 size-4 animate-spin" />Signing in...</>
                ) : (
                  <>Sign In<ArrowRight className="ml-2 size-4" /></>
                )}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-stone-200" />
              <span className="text-2xs font-bold uppercase tracking-[0.4em] text-stone-400">or</span>
              <div className="h-px flex-1 bg-stone-200" />
            </div>

            <div className="flex flex-col items-center space-y-3">
              <span className="text-sm font-medium text-stone-500">Continue with</span>
              <div className="grid w-full grid-cols-2 gap-3">
                <OAuthButton
                  label="Microsoft Entra ID"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" className="size-5">
                      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                    </svg>
                  }
                />
                <OAuthButton label="AWS Cognito" icon={<FaAws className="size-5 text-[#FF9900]" />} />
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-stone-400">Protected by enterprise-grade security</p>
          </div>
        </div>
      </main>

      {/* ── RIGHT — Hero ── */}
      <aside className="relative hidden h-screen w-1/2 flex-col overflow-hidden bg-slate-950 md:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-stone-900 to-slate-950" />
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] animate-pulse rounded-full bg-brand/10 blur-[120px]" style={{ animationDuration: '4s' }} />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] animate-pulse rounded-full bg-emerald-500/10 blur-[120px]" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 animate-[spin_40s_linear_infinite] rounded-full bg-gradient-to-r from-transparent via-brand/5 to-transparent blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.2]"
          style={{ backgroundImage: `radial-gradient(circle at center, #ffffff 1px, transparent 1px)`, backgroundSize: '24px 24px' }}
        />
        <style>{`
          @keyframes float-slow { 0%, 100% { transform: translate(0, 0) rotate(0deg); } 50% { transform: translate(0, -20px) rotate(3deg); } }
          .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
          .animate-float-delayed { animation: float-slow 7s ease-in-out infinite 2s; }
        `}</style>
        <div className="absolute right-16 top-1/4 h-32 w-32 animate-float-slow rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md" />
        <div className="absolute bottom-1/3 left-16 h-20 w-20 animate-float-delayed rounded-full border border-brand/20 bg-brand/10 shadow-2xl backdrop-blur-md" />
        <div className="relative z-10 flex h-full flex-col justify-between p-8 lg:p-12">
          <div className="flex items-center justify-between">
            <div className="flex h-10 items-center lg:h-12">
              <img
                src="/logo-white.png"
                alt="Stone Suite"
                className="h-full w-auto object-contain drop-shadow-lg"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                  const parent = e.currentTarget.parentElement
                  if (parent) parent.innerHTML = '<span style="color:white;font-size:1.15rem;font-weight:700;letter-spacing:0.05em">STONE SUITE</span>'
                }}
              />
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-label lg:px-4 lg:py-1.5 font-medium tracking-wide text-white backdrop-blur-sm transition-transform hover:scale-105">
              Enterprise Ready
            </div>
          </div>
          <div className="max-w-xl">
            <div className="mb-4 inline-flex transform items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 lg:px-4 lg:py-2 transition-all hover:-translate-y-1 hover:bg-brand/20">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand"></span>
              </span>
              <span className="text-2xs lg:text-xs font-semibold uppercase tracking-widest text-brand">Next-Gen Platform</span>
            </div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white md:text-4xl lg:text-5xl">
              Elevate your <br />
              <span className="bg-gradient-to-r from-brand via-emerald-400 to-teal-400 bg-clip-text text-transparent">stone operations.</span>
            </h1>
            <p className="mt-4 max-w-lg text-sm lg:text-base leading-relaxed text-slate-300">
              Experience seamless workflow management, real-time material tracking, and unmatched clarity across your entire fabrication process.
            </p>
            <div className="mt-6 grid max-w-lg gap-3 sm:grid-cols-2 lg:mt-8">
              <div className="group cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-4 lg:p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                <div className="mb-2 inline-flex rounded-lg bg-emerald-500/20 p-1.5 lg:p-2 text-emerald-400 transition-transform group-hover:scale-110 group-hover:bg-emerald-500/30">
                  <svg className="size-4 lg:size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h3 className="text-xs lg:text-sm font-semibold text-white">Smart Workflows</h3>
                <p className="mt-1 text-label lg:text-xs leading-relaxed text-slate-400">Automate tasks and streamline team coordination effortlessly.</p>
              </div>
              <div className="group cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-4 lg:p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                <div className="mb-2 inline-flex rounded-lg bg-brand/20 p-1.5 lg:p-2 text-brand transition-transform group-hover:scale-110 group-hover:bg-brand/30">
                  <svg className="size-4 lg:size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <h3 className="text-xs lg:text-sm font-semibold text-white">Ironclad Security</h3>
                <p className="mt-1 text-label lg:text-xs leading-relaxed text-slate-400">Enterprise-grade protection for your critical business data.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 pt-4 lg:pt-6">
            <p className="text-2xs lg:text-xs font-medium uppercase tracking-widest text-slate-500">© {new Date().getFullYear()} Stone Suite</p>
            <div className="flex items-center gap-2 lg:gap-3">
              <span className="flex h-7 w-7 lg:h-8 lg:w-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
                <svg className="size-3 lg:size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
              </span>
              <span className="flex h-7 w-7 lg:h-8 lg:w-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
                <svg className="size-3 lg:size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
