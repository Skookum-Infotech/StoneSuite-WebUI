import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Lock,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  Check,
  Loader2,
  Mail,
  AlertCircle,
  KeyRound,
  UserCircle,
  Zap,
} from 'lucide-react'
import { authService } from '@/services/authService'
import { userService, rbacService } from '@/services/tenantServices'
import { useAuthStore } from '@/store/useAuthStore'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import { apiErrorMessage } from '@/api/tenantClient'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/auth'
import type { Grant } from '@/types/tenant'

// ── Password schema ──────────────────────────────────────────────────────────

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Must be at least 8 characters')
      .regex(/[A-Z]/, 'Must include an uppercase letter')
      .regex(/[0-9]/, 'Must include a number'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type PasswordFields = z.infer<typeof passwordSchema>
type Tab = 'profile' | 'password' | 'roles'

// ── Read-only field ──────────────────────────────────────────────────────────

function ReadOnlyField({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon?: React.ElementType
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-stone-500">{label}</Label>
      <div className="flex h-11 items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3.5">
        {Icon && <Icon className="size-4 shrink-0 text-stone-300" />}
        <span className="flex-1 text-xs text-stone-600 select-all">{value || '—'}</span>
        <Lock className="size-3.5 shrink-0 text-stone-300" />
      </div>
    </div>
  )
}

// ── Password strength ────────────────────────────────────────────────────────

function StrengthMeter({ password }: { password: string }) {
  if (!password) return null
  const score = (() => {
    let s = 0
    if (password.length >= 8) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    return s
  })()
  const colors = ['', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-500']
  const textColors = ['', 'text-red-500', 'text-amber-500', 'text-blue-500', 'text-emerald-600']
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  return (
    <div className="pt-1.5 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div key={level} className={cn('h-1 flex-1 rounded-full transition-all duration-300', score >= level ? colors[score] : 'bg-stone-200')} />
        ))}
      </div>
      <p className="text-xs text-stone-400">
        Strength: <span className={cn('font-semibold', textColors[score])}>{labels[score]}</span>
      </p>
    </div>
  )
}

// ── Role card ────────────────────────────────────────────────────────────────

function RoleCard({
  role,
  isActive,
  isSwitching,
  disabled,
  onSelect,
}: {
  role: UserRole
  isActive: boolean
  isSwitching: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'group relative w-full rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60',
        isActive ? 'border-brand bg-brand/5 shadow-sm shadow-brand/10' : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50',
      )}
      aria-pressed={isActive}
      aria-busy={isSwitching}
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors', isActive ? 'bg-brand/20 text-brand-dark' : 'bg-stone-100 text-stone-400 group-hover:bg-stone-200')}>
          {isSwitching ? <Loader2 className="size-4.5 animate-spin" /> : <Shield className="size-4.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <span className={cn('block text-xs font-bold transition-colors', isActive ? 'text-stone-900' : 'text-stone-700 group-hover:text-stone-900')}>
            {role.name}
          </span>
          <span className="block text-xs text-stone-400 font-mono mt-0.5">{role.key}</span>
        </div>
        <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all mt-0.5', isActive ? 'border-brand bg-brand' : 'border-stone-300 bg-white group-hover:border-stone-400')}>
          {isActive && <Check className="size-3 text-stone-900" />}
        </div>
      </div>
    </button>
  )
}

// ── Access summary ───────────────────────────────────────────────────────────

const RESOURCE_GROUPS = [
  {
    label: 'CRM',
    resources: [
      { key: 'lead',     label: 'Leads'     },
      { key: 'prospect', label: 'Prospects' },
      { key: 'customer', label: 'Customers' },
    ],
  },
  {
    label: 'Configuration',
    resources: [
      { key: 'workflow',        label: 'Workflows'      },
      { key: 'role',            label: 'Roles'          },
      { key: 'user',            label: 'Users'          },
      { key: 'workflow_config', label: 'Record Numbers' },
      { key: 'sso_config',      label: 'SSO Configuration' },
    ],
  },
]

// Derives a single plain-English access level from a set of grants for one resource.
function accessLevel(grants: Grant[], resource: string): { label: string; desc: string; style: string } | null {
  const mine = grants.filter(g => g.resource === resource || g.resource === '*')
  if (mine.length === 0) return null

  const has = (action: string) => mine.some(g => g.action === action || g.action === '*')
  const scope = mine[0]?.scope === 'all' ? 'all' : 'your own'

  if (has('delete') && has('create') && has('update'))
    return { label: 'Full access',  desc: `Manage ${scope} records`,   style: 'bg-brand/10 text-brand-dark border-brand/30' }
  if (has('create') && has('update'))
    return { label: 'Can edit',     desc: `Create & edit ${scope}`,    style: 'bg-blue-50 text-blue-700 border-blue-200' }
  if (has('create'))
    return { label: 'Can create',   desc: `View & create ${scope}`,    style: 'bg-blue-50 text-blue-700 border-blue-200' }
  if (has('configure'))
    return { label: 'Can configure', desc: 'Manage settings',          style: 'bg-violet-50 text-violet-700 border-violet-200' }
  if (has('read'))
    return { label: 'View only',    desc: `Read ${scope} records`,     style: 'bg-stone-100 text-stone-600 border-stone-200' }
  return null
}

function AccessSummary({ grants }: { grants: Grant[] }) {
  const isSuperAdmin = grants.some(g => g.resource === '*' && g.action === '*')

  if (isSuperAdmin) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
          <Zap className="size-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-stone-900">Full Access — Super Admin</p>
          <p className="text-xs text-stone-500 mt-0.5">Unrestricted access to all features and settings.</p>
        </div>
      </div>
    )
  }

  const rows = RESOURCE_GROUPS.flatMap(group =>
    group.resources.map(r => ({ ...r, group: group.label, level: accessLevel(grants, r.key) }))
  ).filter(r => r.level !== null)

  if (rows.length === 0) {
    return <p className="text-xs text-stone-400 py-2">No permissions found for this role.</p>
  }

  return (
    <div className="space-y-1.5">
      {rows.map(row => (
        <div key={row.key} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-stone-50 transition-colors">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-stone-100">
            <Check className="size-3.5 text-stone-500" />
          </div>
          <span className="flex-1 text-xs font-medium text-stone-700">{row.label}</span>
          <span className="text-xs text-stone-400">{row.level!.desc}</span>
          <span className={cn(
            'shrink-0 rounded-full border px-2.5 py-0.5 text-2xs font-bold',
            row.level!.style,
          )}>
            {row.level!.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Avatar initials ──────────────────────────────────────────────────────────

function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('')
  return (
    <div className={cn('flex items-center justify-center bg-brand font-bold text-stone-900 shrink-0', className)}>
      {initials || '?'}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AccountSettingsPage() {
  const { user, setAuth } = useAuthStore()
  const { grants, isLoading: permissionsLoading, activeRoleId } = useUserPermissions()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const [firstName, ...lastParts] = (user?.fullName ?? '').split(' ')
  const lastName = lastParts.join(' ')

  const { data: workspaceUsers } = useQuery({
    queryKey: ['workspace-users'],
    queryFn: () => userService.listUsers(),
    staleTime: 1000 * 60 * 2,
    enabled: Boolean(user?.email),
  })

  const currentWorkspaceUser = workspaceUsers?.find((u) => u.email === user?.email)
  const roles: UserRole[] =
    currentWorkspaceUser?.roles?.map((r) => ({ id: r.id, key: r.key, name: r.name })) ??
    user?.roles ?? []

  // Server's active-role claim is the source of truth; user?.selectedRoleId
  // (persisted locally) and the first assigned role are fallbacks only for
  // while permissions are still loading — no separate state to reconcile.
  const selectedRoleId = activeRoleId || user?.selectedRoleId || roles[0]?.id || ''

  const { register, handleSubmit, reset, control, setError, formState: { errors, isSubmitting } } =
    useForm<PasswordFields>({ resolver: zodResolver(passwordSchema) })

  const newPasswordValue = useWatch({ control, name: 'newPassword', defaultValue: '' })

  const onPasswordSubmit = async (data: PasswordFields) => {
    try {
      await authService.changePassword(data.currentPassword, data.newPassword)
      setPasswordSuccess(true)
      reset()
      setTimeout(() => setPasswordSuccess(false), 4000)
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Failed to update password') })
    }
  }

  // Switching roles re-signs the JWT server-side with an active_role_id claim
  // that narrows authz enforcement to that one role — this is a real context
  // switch, not a UI-only filter, so it must round-trip through the backend.
  const switchRoleMutation = useMutation({
    mutationFn: (roleId: string) => rbacService.switchRole(roleId),
    onSuccess: (data, roleId) => {
      if (user) {
        setAuth({ ...user, selectedRoleId: roleId }, data.token, data.expiresAt)
      }
      // The active role changed server-side — the cached grant set is stale.
      queryClient.invalidateQueries({ queryKey: ['user-permissions', user?.id] })
    },
  })

  const navItems: { id: Tab; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: 'profile', label: 'Profile', icon: UserCircle },
    { id: 'password', label: 'Password', icon: KeyRound },
    { id: 'roles', label: 'Roles & Access', icon: Shield, badge: roles.length > 0 ? String(roles.length) : undefined },
  ]

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 sm:p-6 3xl:p-10 4xl:p-14 flex flex-col gap-4 sm:gap-5 h-full">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900">Account Settings</h1>
            <p className="text-xs text-stone-500 mt-0.5">Manage your profile, password, and session role</p>
          </div>
        </div>

        {/* ── Two-panel layout ── */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 flex-1 min-h-0 sm:items-start">

          {/* Left nav — sidebar on desktop, compact strip + pill tabs on mobile */}
          <aside className="w-full sm:w-52 shrink-0 sm:sticky sm:top-0">
            <nav className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow">
              {/* Avatar block — vertical on desktop, horizontal on mobile */}
              <div className="flex sm:flex-col items-center gap-3 px-4 py-3.5 sm:py-6 bg-gradient-to-b from-stone-50 to-white border-b border-stone-100">
                <Avatar
                  name={user?.fullName ?? ''}
                  className="h-12 w-12 sm:h-20 sm:w-20 rounded-xl sm:rounded-2xl text-xl sm:text-3xl"
                />
                <div className="flex-1 sm:flex-none sm:text-center min-w-0">
                  <p className="text-xs font-bold text-stone-900 leading-tight truncate">{user?.fullName ?? '—'}</p>
                  <p className="text-xs text-stone-400 mt-0.5 truncate sm:max-w-[168px]">{user?.email ?? '—'}</p>
                </div>
                {roles.length > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-2xs font-bold text-brand-dark">
                    <Shield className="size-3" />
                    {roles.find(r => r.id === selectedRoleId)?.name ?? roles[0]?.name}
                  </span>
                )}
              </div>

              {/* Nav links — horizontal scroll on mobile, vertical stack on desktop */}
              <div className="p-2 sm:p-2.5 flex sm:flex-col gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {navItems.map(({ id, label, icon: Icon, badge }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      'group flex shrink-0 sm:w-full items-center gap-2 sm:gap-2.5 rounded-xl px-3 py-2 sm:py-2.5 text-left transition-all duration-150 cursor-pointer',
                      activeTab === id
                        ? 'bg-[#001219] text-white shadow-sm'
                        : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
                    )}
                  >
                    <Icon className={cn('size-3.5 sm:size-4 shrink-0', activeTab === id ? 'text-brand' : 'text-stone-400 group-hover:text-stone-600')} />
                    <span className="text-xs font-semibold whitespace-nowrap">{label}</span>
                    {badge && (
                      <span className={cn('flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full text-2xs font-bold', activeTab === id ? 'bg-brand/20 text-brand' : 'bg-stone-200 text-stone-500')}>
                        {badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </nav>
          </aside>

          {/* Right content */}
          <div className="flex-1 min-w-0">

            {/* ── Profile tab ── */}
            {activeTab === 'profile' && (
              <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-stone-100 bg-stone-50/60">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
                      <UserCircle className="size-4.5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-stone-900">Profile Information</h2>
                      <p className="text-xs text-stone-500 mt-0.5">View-only — managed by your workspace administrator</p>
                    </div>
                  </div>
                </div>
                <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
                  <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
                    <ReadOnlyField label="First Name" value={firstName} />
                    <ReadOnlyField label="Last Name" value={lastName} />
                  </div>
                  <ReadOnlyField label="Email Address" value={user?.email ?? ''} icon={Mail} />

                  <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3.5">
                    <AlertCircle className="size-4 shrink-0 text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-800">Read-only fields</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Profile fields can only be edited by a <strong>super-admin</strong>. Contact your workspace admin to request changes.
                      </p>
                    </div>
                  </div>

                  {/* Account meta */}
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-stone-100">
                    <div className="rounded-xl bg-stone-50 border border-stone-200 px-4 py-3">
                      <p className="text-xs font-semibold text-stone-500">Account Type</p>
                      <p className="text-xs font-semibold text-stone-800 mt-1">
                        {user?.isPlatformAdmin ? 'Platform Admin' : 'Workspace Member'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-stone-50 border border-stone-200 px-4 py-3">
                      <p className="text-xs font-semibold text-stone-500">Active Role</p>
                      <p className="text-xs font-semibold text-stone-800 mt-1">
                        {roles.find(r => r.id === selectedRoleId)?.name ?? (roles[0]?.name ?? 'None')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Password tab ── */}
            {activeTab === 'password' && (
              <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-stone-100 bg-stone-50/60">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
                      <KeyRound className="size-4.5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-stone-900">Update Password</h2>
                      <p className="text-xs text-stone-500 mt-0.5">Use an uppercase letter and number for a strong password</p>
                    </div>
                  </div>
                </div>
                <div className="px-4 sm:px-6 py-4 sm:py-6">
                  {passwordSuccess && (
                    <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
                      <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-800">Password updated</p>
                        <p className="text-xs text-emerald-600 mt-0.5">Your new password is active immediately.</p>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-5">
                    {/* Current password — full width */}
                    <div className="space-y-1.5">
                      <Label htmlFor="currentPassword" className="text-xs font-semibold text-stone-500">
                        Current Password
                      </Label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-300" />
                        <Input
                          id="currentPassword"
                          type={showCurrent ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="Enter your current password"
                          aria-invalid={Boolean(errors.currentPassword)}
                          {...register('currentPassword')}
                          className="h-11 rounded-xl border-stone-200 bg-white pl-10 pr-11 text-stone-950 placeholder:text-stone-300"
                        />
                        <button type="button" onClick={() => setShowCurrent(v => !v)} aria-label="Toggle" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors">
                          {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
                    </div>

                    {/* New + Confirm — side by side on sm+ */}
                    <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="newPassword" className="text-xs font-semibold text-stone-500">
                          New Password
                        </Label>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-300" />
                          <Input
                            id="newPassword"
                            type={showNew ? 'text' : 'password'}
                            autoComplete="new-password"
                            placeholder="Min 8 characters"
                            aria-invalid={Boolean(errors.newPassword)}
                            {...register('newPassword')}
                            className="h-11 rounded-xl border-stone-200 bg-white pl-10 pr-11 text-stone-950 placeholder:text-stone-300"
                          />
                          <button type="button" onClick={() => setShowNew(v => !v)} aria-label="Toggle" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors">
                            {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                        {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
                        <StrengthMeter password={newPasswordValue} />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="confirmPassword" className="text-xs font-semibold text-stone-500">
                          Confirm Password
                        </Label>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-300" />
                          <Input
                            id="confirmPassword"
                            type={showConfirm ? 'text' : 'password'}
                            autoComplete="new-password"
                            placeholder="Repeat new password"
                            aria-invalid={Boolean(errors.confirmPassword)}
                            {...register('confirmPassword')}
                            className="h-11 rounded-xl border-stone-200 bg-white pl-10 pr-11 text-stone-950 placeholder:text-stone-300"
                          />
                          <button type="button" onClick={() => setShowConfirm(v => !v)} aria-label="Toggle" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors">
                            {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                        {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
                      </div>
                    </div>

                    {/* Password rules */}
                    <div className="rounded-xl bg-stone-50 border border-stone-200 px-4 py-3.5 grid grid-cols-2 gap-2">
                      {[
                        'At least 8 characters',
                        'One uppercase letter',
                        'One number',
                        'Special character (recommended)',
                      ].map((rule) => (
                        <div key={rule} className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-stone-300 shrink-0" />
                          <span className="text-xs text-stone-500">{rule}</span>
                        </div>
                      ))}
                    </div>

                    {errors.root && (
                      <div className="flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3.5">
                        <AlertCircle className="size-4 shrink-0 text-destructive" />
                        <p className="text-xs text-destructive">{errors.root.message}</p>
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="h-10 rounded-xl bg-brand px-6 text-sm font-semibold text-stone-950 hover:bg-brand-hover active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
                        style={{ boxShadow: '0 4px 14px rgba(194,245,137,0.35)' }}
                      >
                        {isSubmitting
                          ? <><Loader2 className="mr-2 size-4 animate-spin" />Updating…</>
                          : 'Update Password'}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ── Roles tab ── */}
            {activeTab === 'roles' && (
              <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-stone-100 bg-stone-50/60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
                        <Shield className="size-4.5" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-stone-900">Roles & Access</h2>
                        <p className="text-xs text-stone-500 mt-0.5">Your assigned roles — select one to make it active for this session</p>
                      </div>
                    </div>
                    {roles.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
                        {roles.length} {roles.length === 1 ? 'role' : 'roles'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="px-4 sm:px-6 py-4 sm:py-6">
                  {roles.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-stone-200 py-12 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 mb-3">
                        <Shield className="size-6 text-stone-300" />
                      </div>
                      <p className="text-xs font-semibold text-stone-500">No roles assigned</p>
                      <p className="text-xs text-stone-400 mt-1">Contact your workspace administrator to get access.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {roles.map((role) => (
                          <RoleCard
                            key={role.id}
                            role={role}
                            isActive={selectedRoleId === role.id}
                            isSwitching={switchRoleMutation.isPending && switchRoleMutation.variables === role.id}
                            disabled={switchRoleMutation.isPending}
                            onSelect={() => switchRoleMutation.mutate(role.id)}
                          />
                        ))}
                      </div>

                      {switchRoleMutation.isError && (
                        <div className="flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3.5">
                          <AlertCircle className="size-4 shrink-0 text-destructive" />
                          <p className="text-xs text-destructive">
                            {apiErrorMessage(switchRoleMutation.error, 'Failed to switch role. Please try again.')}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50 px-4 py-3.5">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand shadow-sm">
                          {switchRoleMutation.isPending
                            ? <Loader2 className="size-3.5 animate-spin text-stone-900" />
                            : <Check className="size-3.5 text-stone-900" />}
                        </div>
                        <p className="text-xs text-stone-600">
                          Active role:{' '}
                          <strong className="text-stone-900">
                            {roles.find(r => r.id === selectedRoleId)?.name ?? '—'}
                          </strong>
                          {' '}— changes take effect immediately.
                        </p>
                      </div>

                      {/* Permissions matrix */}
                      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50/60">
                          <p className="text-xs font-bold text-stone-700">Permission Summary</p>
                          <p className="text-2xs text-stone-400">What your active role can do</p>
                        </div>
                        <div className="px-4 py-4">
                          {permissionsLoading ? (
                            <div className="flex items-center gap-2 py-4 text-xs text-stone-400">
                              <Loader2 className="size-4 animate-spin" />
                              Loading permissions…
                            </div>
                          ) : (
                            <AccessSummary grants={grants} />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
