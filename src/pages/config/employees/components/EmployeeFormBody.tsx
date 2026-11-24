import { ModernSection, ModernFieldShell } from '@/components/crm/FormPrimitives';
import { fieldCls, textareaCls } from '@/components/crm/formUtils';
import { PhoneNumberInput } from '@/components/crm/PhoneNumberInput';
import type { EmployeeErrors } from '@/lib/employeeForm';
import type { EmployeeFields } from '@/types/employee';

/** The employee profile fields, shared by the Add and Edit pages. `emailLocked`
 *  is set for an employee who is also a login user: their email is their
 *  sign-in identity and is changed under Users, not here. */
export function EmployeeFormBody({ value, onChange, errors, emailLocked }: {
  value: EmployeeFields;
  onChange: (next: EmployeeFields) => void;
  errors: EmployeeErrors;
  emailLocked?: boolean;
}) {
  const set = (key: keyof EmployeeFields, v: string) => onChange({ ...value, [key]: v });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto modal-scrollbar px-4 py-4 sm:px-5 sm:py-5 3xl:px-12 4xl:px-16">
      <div className="mx-auto max-w-4xl space-y-3">
        <ModernSection title="Personal Information" index={0}>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <ModernFieldShell label="First name" required>
              <input
                type="text"
                value={value.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                className={fieldCls}
                aria-label="First name"
                aria-invalid={Boolean(errors.firstName)}
                autoFocus
              />
              {errors.firstName && <p role="alert" className="type-error">{errors.firstName}</p>}
            </ModernFieldShell>
            <ModernFieldShell label="Last name">
              <input
                type="text"
                value={value.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                className={fieldCls}
                aria-label="Last name"
                aria-invalid={Boolean(errors.lastName)}
              />
              {errors.lastName && <p role="alert" className="type-error">{errors.lastName}</p>}
            </ModernFieldShell>
            <ModernFieldShell label="Email" required>
              <input
                type="email"
                value={value.email}
                onChange={(e) => set('email', e.target.value)}
                disabled={emailLocked}
                className={fieldCls}
                aria-label="Email"
                aria-invalid={Boolean(errors.email)}
              />
              {emailLocked && (
                <p className="type-helper">This person can sign in, so their email is changed under Users.</p>
              )}
              {errors.email && <p role="alert" className="type-error">{errors.email}</p>}
            </ModernFieldShell>
            <ModernFieldShell label="Phone">
              <PhoneNumberInput
                value={value.phone}
                onChange={(next) => set('phone', next)}
                className={fieldCls}
                aria-label="Phone"
              />
              {errors.phone && <p role="alert" className="type-error">{errors.phone}</p>}
            </ModernFieldShell>
          </div>
        </ModernSection>

        <ModernSection title="Work" index={1}>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <ModernFieldShell label="Job title">
              <input
                type="text"
                value={value.jobTitle}
                onChange={(e) => set('jobTitle', e.target.value)}
                className={fieldCls}
                aria-label="Job title"
              />
              {errors.jobTitle && <p role="alert" className="type-error">{errors.jobTitle}</p>}
            </ModernFieldShell>
            <ModernFieldShell label="Department">
              <input
                type="text"
                value={value.department}
                onChange={(e) => set('department', e.target.value)}
                className={fieldCls}
                aria-label="Department"
              />
              {errors.department && <p role="alert" className="type-error">{errors.department}</p>}
            </ModernFieldShell>
            <div className="col-span-full">
              <ModernFieldShell label="Address">
                <textarea
                  rows={3}
                  value={value.address}
                  onChange={(e) => set('address', e.target.value)}
                  className={textareaCls}
                  aria-label="Address"
                />
                {errors.address && <p role="alert" className="type-error">{errors.address}</p>}
              </ModernFieldShell>
            </div>
          </div>
        </ModernSection>
      </div>
    </div>
  );
}
