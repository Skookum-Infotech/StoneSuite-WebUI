import { DatePicker } from '@/components/ui/date-picker';
import { fieldCls, textareaCls } from '@/components/crm/formUtils';
import {
  NOTES_MAX, START_TIMES, VISIT_TYPES, VISIT_TYPE_LABELS, durationLabel, durationOptions, withVisitType,
} from '@/lib/installAppointmentForm';
import type { VisitForm } from '@/lib/installAppointmentForm';
import type { CrewOption, VisitType } from '@/types/installSchedule';
import { InstallCrewPicker } from './InstallCrewPicker';

interface Props {
  form: VisitForm;
  onChange: (next: VisitForm) => void;
  crewOptions: CrewOption[];
  idPrefix: string;
}

const labelCls = 'mb-1 block text-xs font-medium text-stone-600';

/** The visit's own fields (type, when, crew, notes); the job is chosen above. */
export function InstallVisitFields({ form, onChange, crewOptions, idPrefix }: Props) {
  const set = (patch: Partial<VisitForm>) => onChange({ ...form, ...patch });
  const timeId = `${idPrefix}-time`;
  const durId = `${idPrefix}-duration`;
  const notesId = `${idPrefix}-notes`;

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className={labelCls}>Visit type</legend>
        <div className="flex flex-wrap gap-4">
          {VISIT_TYPES.map((t: VisitType) => (
            <label key={t} className="flex items-center gap-1.5 text-xs text-stone-800">
              <input
                type="radio"
                name={`${idPrefix}-type`}
                checked={form.visitType === t}
                onChange={() => onChange(withVisitType(form, t))}
              />
              {VISIT_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className={labelCls}>{form.allDay ? 'First day' : 'Date'}</span>
          <DatePicker
            value={form.date}
            label={form.allDay ? 'First day' : 'Date'}
            onChange={(date) => set({ date, endDate: form.endDate < date ? date : form.endDate })}
            required
          />
        </div>
        {form.allDay && (
          <div>
            <span className={labelCls}>Last day</span>
            <DatePicker value={form.endDate} label="Last day" minDate={form.date} onChange={(endDate) => set({ endDate })} />
          </div>
        )}
        {!form.allDay && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={timeId} className={labelCls}>Start time</label>
              <select id={timeId} value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} className={fieldCls}>
                {START_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={durId} className={labelCls}>Duration</label>
              <select id={durId} value={form.durationMin} onChange={(e) => set({ durationMin: Number(e.target.value) })} className={fieldCls}>
                {durationOptions(form.durationMin).map((m) => <option key={m} value={m}>{durationLabel(m)}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-stone-800">
        <input type="checkbox" checked={form.allDay} onChange={(e) => set({ allDay: e.target.checked })} />
        All day
      </label>

      <InstallCrewPicker value={form.crew} onChange={(crew) => set({ crew })} options={crewOptions} />

      <div>
        <label htmlFor={notesId} className={labelCls}>Notes</label>
        <textarea
          id={notesId}
          rows={3}
          maxLength={NOTES_MAX}
          value={form.notes}
          onChange={(e) => set({ notes: e.target.value })}
          className={textareaCls}
        />
      </div>
    </div>
  );
}
