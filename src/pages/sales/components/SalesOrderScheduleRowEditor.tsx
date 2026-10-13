import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { fieldCls, textareaCls, fieldLabelCls } from '@/components/crm/formUtils';
import { toISODate } from '@/lib/dateUtils';
import { SCHEDULE_STATUS_LABELS, joinWallClock, splitWallClock } from '@/lib/salesOrderSchedule';
import type {
  SalesOrderScheduleActivity,
  SalesOrderScheduleActivityPatch,
  ScheduleActivityStatus,
} from '@/types/salesOrder';

const NOTES_MAX_LENGTH = 2000;
const NOTES_ROWS = 2;
const CREATED_CODE = 'created';

// Matches the DatePicker trigger beside it (h-8, stone-200 border).
const TIME_INPUT_CLS =
  'h-8 w-28 shrink-0 rounded-lg border border-stone-200 bg-white px-2.5 text-sm text-stone-900 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

const STATUS_OPTIONS: { value: ScheduleActivityStatus; label: string }[] = [
  { value: 'pending', label: SCHEDULE_STATUS_LABELS.pending },
  { value: 'in_progress', label: SCHEDULE_STATUS_LABELS.in_progress },
  { value: 'completed', label: SCHEDULE_STATUS_LABELS.completed },
];

/** The edit-mode row of the Scheduling tab: change one activity's status,
 *  scheduled time, completed-on time, and notes, then save them in one request.
 *  Only the fields that actually changed are sent. */
export function SalesOrderScheduleRowEditor({ activity, saving, error, onSave, onCancel }: {
  activity: SalesOrderScheduleActivity;
  saving: boolean;
  /** A server rejection to show above the buttons. */
  error?: string;
  onSave: (patch: SalesOrderScheduleActivityPatch) => void;
  onCancel: () => void;
}) {
  const scheduled = splitWallClock(activity.scheduledAt);
  const completed = splitWallClock(activity.completedAt);

  const [status, setStatus] = useState<ScheduleActivityStatus>(activity.status);
  const [schedDate, setSchedDate] = useState(scheduled?.date ?? '');
  const [schedTime, setSchedTime] = useState(scheduled?.time ?? '');
  const [doneDate, setDoneDate] = useState(completed?.date ?? '');
  const [doneTime, setDoneTime] = useState(completed?.time ?? '');
  const [notes, setNotes] = useState(activity.notes);
  const [localError, setLocalError] = useState('');

  // The Created row is recorded by the system; only its date and notes are editable.
  const statusLocked = activity.code === CREATED_CODE;

  function handleSave() {
    if (!schedDate || !schedTime) {
      setLocalError('Enter the scheduled date and time.');
      return;
    }
    const patch: SalesOrderScheduleActivityPatch = {};
    if (status !== activity.status) patch.status = status;
    if (schedDate !== scheduled?.date || schedTime !== scheduled?.time) {
      patch.scheduledAt = joinWallClock(schedDate, schedTime);
    }
    if (status === 'completed') {
      if (doneTime && !doneDate) {
        setLocalError('Pick the completed date as well as the time.');
        return;
      }
      const doneChanged = doneDate !== (completed?.date ?? '') || doneTime !== (completed?.time ?? '');
      if (doneChanged && doneDate) {
        if (doneDate > toISODate(new Date())) {
          setLocalError('Completed on cannot be in the future.');
          return;
        }
        patch.completedAt = joinWallClock(doneDate, doneTime || '00:00');
      }
    }
    if (notes.trim() !== activity.notes) patch.notes = notes.trim();
    if (Object.keys(patch).length === 0) {
      onCancel();
      return;
    }
    setLocalError('');
    onSave(patch);
  }

  const shownError = localError || error;
  const label = (text: string) => `${text} for ${activity.name}`;

  return (
    <div className="space-y-3 bg-stone-50 px-3 py-3">
      <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label className={fieldLabelCls} htmlFor={`status-${activity.code}`}>Status</label>
          <select
            id={`status-${activity.code}`}
            value={status}
            disabled={statusLocked || saving}
            onChange={(e) => setStatus(e.target.value as ScheduleActivityStatus)}
            className={fieldCls}
            aria-label={label('Status')}
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {statusLocked && <p className="text-2xs text-stone-400">Recorded automatically when the order is created.</p>}
        </div>

        <div className="space-y-1">
          <span className={fieldLabelCls}>Scheduled</span>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <DatePicker value={schedDate} onChange={setSchedDate} label={label('Scheduled date')} disabled={saving} />
            </div>
            <input
              type="time"
              value={schedTime}
              disabled={saving}
              onChange={(e) => setSchedTime(e.target.value)}
              className={TIME_INPUT_CLS}
              aria-label={label('Scheduled time')}
            />
          </div>
        </div>

        {status === 'completed' && (
          <div className="space-y-1">
            <span className={fieldLabelCls}>Completed on</span>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <DatePicker value={doneDate} onChange={setDoneDate} label={label('Completed date')} disabled={saving} />
              </div>
              <input
                type="time"
                value={doneTime}
                disabled={saving}
                onChange={(e) => setDoneTime(e.target.value)}
                className={TIME_INPUT_CLS}
                aria-label={label('Completed time')}
              />
            </div>
            {!completed && <p className="text-2xs text-stone-400">Leave blank to use the current time.</p>}
          </div>
        )}

        <div className="space-y-1 sm:col-span-2 lg:col-span-1">
          <label className={fieldLabelCls} htmlFor={`notes-${activity.code}`}>Notes</label>
          <textarea
            id={`notes-${activity.code}`}
            rows={NOTES_ROWS}
            maxLength={NOTES_MAX_LENGTH}
            value={notes}
            disabled={saving}
            onChange={(e) => setNotes(e.target.value)}
            className={textareaCls}
            aria-label={label('Notes')}
          />
        </div>
      </div>

      {shownError && <p role="alert" className="text-2xs text-destructive">{shownError}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 shadow-sm transition-all hover:bg-brand-hover disabled:opacity-50"
          aria-label={label('Save changes')}
        >
          {saving && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition-colors hover:bg-stone-50 disabled:opacity-50"
          aria-label={label('Cancel editing')}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
