import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Loader2, Mail, Pencil } from 'lucide-react'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/useAuthStore'
import { apiErrorMessage } from '@/api/tenantClient'
import {
  joinFullName,
  profileNameSchema,
  splitFullName,
  type ProfileNameFields,
} from '@/lib/profileName'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ReadOnlyField } from './ReadOnlyField'

const SAVED_BANNER_MS = 4000
// Everywhere the signed-in user's name is listed from a cached query.
const NAME_QUERY_KEYS = [['users'], ['assignable-users']] as const

const INPUT_BASE_CLASS = 'h-11 rounded-xl border-stone-200 text-stone-950 placeholder:text-stone-300'
const INPUT_EDITING_CLASS = `${INPUT_BASE_CLASS} bg-white`
// Locked look while not editing: same box, muted, so it reads as a display value.
const INPUT_LOCKED_CLASS = `${INPUT_BASE_CLASS} bg-stone-50 text-stone-600 cursor-default`

export function ProfileNameForm({ fullName, email }: { fullName: string; email: string }) {
  const queryClient = useQueryClient()
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const [saved, setSaved] = useState(false)
  // Names stay locked until the user clicks Edit, so a stray keystroke can't
  // change them; Cancel or a successful Save locks them again.
  const [editing, setEditing] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileNameFields>({
    resolver: zodResolver(profileNameSchema),
    defaultValues: splitFullName(fullName),
  })

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), SAVED_BANNER_MS)
    return () => clearTimeout(timer)
  }, [saved])

  // The inputs only stop being read-only after the render that flips
  // `editing`, so focus has to wait for it.
  useEffect(() => {
    if (editing) setFocus('firstName')
  }, [editing, setFocus])

  const startEditing = () => {
    setSaved(false)
    setEditing(true)
  }

  // reset() with no args restores the last saved values and clears any error.
  const cancelEditing = () => {
    reset()
    setEditing(false)
  }

  const onSubmit = async (data: ProfileNameFields) => {
    const nextFullName = joinFullName(data.firstName, data.lastName)
    try {
      await authService.updateMyName(nextFullName)
    } catch (err) {
      setSaved(false)
      setError('root', { message: apiErrorMessage(err, 'Failed to update name') })
      return
    }
    // Header menu and avatar read the persisted profile, so patch it now
    // rather than waiting for a refetch.
    updateProfile({ fullName: nextFullName })
    NAME_QUERY_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
    reset(splitFullName(nextFullName))
    setEditing(false)
    setSaved(true)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5" noValidate>
      {saved && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Name updated</p>
            <p className="text-xs text-emerald-600 mt-0.5">Your new name is showing across the app.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="firstName" className="text-xs font-semibold text-stone-500">
            First Name
          </Label>
          <Input
            id="firstName"
            autoComplete="given-name"
            aria-invalid={Boolean(errors.firstName)}
            readOnly={!editing}
            {...register('firstName')}
            className={editing ? INPUT_EDITING_CLASS : INPUT_LOCKED_CLASS}
          />
          {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName" className="text-xs font-semibold text-stone-500">
            Last Name
          </Label>
          <Input
            id="lastName"
            autoComplete="family-name"
            aria-invalid={Boolean(errors.lastName)}
            readOnly={!editing}
            {...register('lastName')}
            className={editing ? INPUT_EDITING_CLASS : INPUT_LOCKED_CLASS}
          />
          {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
        </div>
      </div>

      <ReadOnlyField label="Email Address" value={email} icon={Mail} />
      <p className="-mt-2 text-xs text-stone-400">
        Your email is your sign-in address, so it can&apos;t be changed here.
      </p>

      {errors.root && (
        <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3.5">
          <AlertCircle className="size-4 shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{errors.root.message}</p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        {editing ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={cancelEditing}
              disabled={isSubmitting}
              aria-label="Cancel editing"
              className="h-10 rounded-xl px-5 text-sm font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isDirty || isSubmitting}
              className="h-10 rounded-xl bg-brand px-6 text-sm font-semibold text-stone-950 shadow-[0_4px_14px_rgba(194,245,137,0.35)] hover:bg-brand-hover active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <><Loader2 className="mr-2 size-4 animate-spin" />Saving…</> : 'Save Changes'}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={startEditing}
            aria-label="Edit name"
            className="h-10 gap-2 rounded-xl px-5 text-sm font-semibold"
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
        )}
      </div>
    </form>
  )
}
