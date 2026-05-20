import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Building2, Lock, Mail, ShieldCheck, Layers, Zap, Globe } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function OAuthButton({
  icon,
  label,
}: {
  icon: ReactNode
  label: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full justify-start gap-3 rounded-xl border-stone-200 bg-white px-4 text-stone-700 shadow-sm transition-all duration-200 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950 focus-visible:ring-stone-400/20"
    >
      <span className="flex size-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
        {icon}
      </span>
      <span className="truncate text-sm font-medium tracking-wide">{label}</span>
    </Button>
  )
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/4 px-5 py-4 backdrop-blur-sm transition-all duration-300 hover:border-white/15 hover:bg-white/8">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-400/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <p className="relative text-2xl font-bold tracking-tight text-white">{value}</p>
      <p className="relative mt-0.5 text-xs font-medium uppercase tracking-widest text-stone-400">{label}</p>
    </div>
  )
}

function FeaturePill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-sm">
      <span className="text-amber-300/80">{icon}</span>
      <span className="text-xs font-medium text-stone-300">{label}</span>
    </div>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
  }

  return (
    <div
      className="min-h-screen md:flex md:flex-row"
      style={{ fontFamily: "'DM Sans', 'Geist', system-ui, sans-serif" }}
    >
      {/* ── LEFT — Login ── */}
      <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-stone-50 px-4 py-12 text-stone-950 sm:px-6 md:w-1/2 lg:px-10">
        {/* Subtle texture overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        {/* Radial glow top-right */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-amber-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-stone-200/80 blur-3xl" />

        <div className="relative w-full max-w-sm sm:max-w-md">
          {/* Card */}
          <div className="rounded-3xl border border-stone-200/80 bg-white/80 p-7 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.15),0_0_0_1px_rgba(255,255,255,0.9)_inset] backdrop-blur-sm sm:p-9">

            {/* Logo + heading */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-stone-200 bg-stone-900 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)]">
                <img
                  src="/logo-white.png"
                  alt="Stone Suite logo"
                  className="h-8 w-auto object-contain"
                  onError={(e) => {
                    // fallback if logo missing
                    (e.currentTarget as HTMLImageElement).style.display = 'none'
                    const parent = e.currentTarget.parentElement
                    if (parent) {
                      parent.innerHTML = '<span style="color:white;font-size:1.25rem;font-weight:700">S</span>'
                    }
                  }}
                />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
                Welcome back
              </h2>
              <p className="mt-2 text-sm text-stone-500">
                Sign in to your Stone Suite workspace
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-widest text-stone-500">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-xl border-stone-200 bg-stone-50/80 pl-10 text-stone-950 placeholder:text-stone-400 focus-visible:border-stone-400 focus-visible:bg-white focus-visible:ring-stone-300/40 transition-colors duration-150"
                  />
                </div>
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
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-xl border-stone-200 bg-stone-50/80 pl-10 text-stone-950 placeholder:text-stone-400 focus-visible:border-stone-400 focus-visible:bg-white focus-visible:ring-stone-300/40 transition-colors duration-150"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="mt-1 h-11 w-full rounded-xl bg-stone-900 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] transition-all duration-200 hover:bg-stone-800 hover:shadow-[0_12px_28px_-8px_rgba(0,0,0,0.45)] active:scale-[0.99] focus-visible:ring-stone-400/30"
              >
                Sign In
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-stone-200" />
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-stone-400">or</span>
              <div className="h-px flex-1 bg-stone-200" />
            </div>

            {/* OAuth */}
            <div className="space-y-2.5">
              <OAuthButton
                label="Continue with Microsoft Entra ID"
                icon={<Building2 className="size-4" />}
              />
              <OAuthButton
                label="Continue with AWS Cognito"
                icon={<ShieldCheck className="size-4" />}
              />
            </div>

            <p className="mt-6 text-center text-xs text-stone-400">
              Protected by enterprise-grade security
            </p>
          </div>
        </div>
      </main>

      {/* ── RIGHT — Hero ── */}
      <aside className="relative flex min-h-screen w-full flex-col overflow-hidden md:w-1/2">
        {/* Deep stone/charcoal base */}
        <div className="absolute inset-0 bg-[#0c0a08]" />

        {/* Layered atmosphere */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_10%,rgba(217,119,6,0.12),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_90%,rgba(120,113,108,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_50%_50%,rgba(255,255,255,0.02),transparent)]" />

        {/* Stone texture grid */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)
            `,
            backgroundSize: '52px 52px',
          }}
        />

        {/* Diagonal accent line */}
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(135deg, transparent 40%, rgba(217,119,6,0.3) 50%, transparent 60%)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-10 xl:p-14">

          {/* Top — logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 border border-white/10">
              <img
                src="/logo-white.png"
                alt="Stone Suite"
                className="h-5 w-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none'
                  const parent = e.currentTarget.parentElement
                  if (parent) parent.innerHTML = '<span style="color:white;font-size:0.9rem;font-weight:700">S</span>'
                }}
              />
            </div>
            <span className="text-sm font-semibold tracking-widest text-stone-300 uppercase">Stone Suite</span>
          </div>

          {/* Middle — hero copy */}
          <div className="max-w-lg">
            {/* Eyebrow */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/8 px-4 py-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-300/90">
                Fabrication Management Platform
              </span>
            </div>

            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white xl:text-[3.25rem]">
              Precision tools for modern{' '}
              <span
                className="relative"
                style={{
                  background: 'linear-gradient(135deg, #fbbf24, #d97706, #92400e)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                stone fabrication.
              </span>
            </h1>

            <p className="mt-5 max-w-md text-base leading-relaxed text-stone-400">
              Streamline your workflow from quote to completion with our integrated suite of fabrication management tools.
            </p>

            {/* Feature pills */}
            <div className="mt-7 flex flex-wrap gap-2">
              <FeaturePill icon={<Zap className="size-3" />} label="Real-time Quoting" />
              <FeaturePill icon={<Layers className="size-3" />} label="Job Scheduling" />
              <FeaturePill icon={<Globe className="size-3" />} label="Client Portal" />
            </div>

            {/* Stats */}
            <div className="mt-8 flex flex-wrap gap-3">
              <StatCard value="500+" label="Projects Managed" />
              <StatCard value="99.9%" label="Uptime SLA" />
              <StatCard value="24/7" label="Support Access" />
            </div>
          </div>

          {/* Bottom — testimonial */}
          <div className="rounded-2xl border border-white/8 bg-white/4 p-5 backdrop-blur-sm">
            <p className="text-sm italic leading-relaxed text-stone-300">
              "Stone Suite cut our quoting time by 60% and gave us full visibility across every job on the floor."
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400/60 to-stone-600/60 border border-white/10" />
              <div>
                <p className="text-xs font-semibold text-stone-200">Marcus T.</p>
                <p className="text-xs text-stone-500">Operations Director, PrimeCut Stone</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}