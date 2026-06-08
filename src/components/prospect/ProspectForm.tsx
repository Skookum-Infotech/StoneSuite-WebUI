import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  PRIMARY_SECTIONS,
  TABS,
  prospectDefaults,
  type ProspectField,
  type ProspectSection,
} from '@/lib/prospectForm';
import { Section, FieldShell, TabBar, inputClass } from '@/components/prospect/ProspectUI';

export function ProspectForm({
  submitting,
  errorMessage,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  errorMessage?: string | null;
  onSubmit: (fields: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState<Record<string, unknown>>(() => prospectDefaults());
  const [activeTab, setActiveTab] = useState(TABS[0]?.key ?? '');
  const set = (key: string, value: unknown) => setData((d) => ({ ...d, [key]: value }));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(data);
  };

  const tab = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {errorMessage && (
        <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-500" />
          <p className="text-xs text-red-700">{errorMessage}</p>
        </div>
      )}

      <SaveBar submitting={submitting} onCancel={onCancel} />

      {PRIMARY_SECTIONS.map((section) => (
        <SectionFields key={section.title} section={section} data={data} set={set} />
      ))}

      {/* Tabbed sections */}
      <div className="rounded border border-stone-200 bg-white">
        <TabBar tabs={TABS} active={tab.key} onSelect={setActiveTab} />
        <div className="space-y-3 p-3">
          {tab.sections.map((section) => (
            <SectionFields key={section.title} section={section} data={data} set={set} />
          ))}
        </div>
      </div>

      <SaveBar submitting={submitting} onCancel={onCancel} />
    </form>
  );
}

function SaveBar({ submitting, onCancel }: { submitting: boolean; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-1 rounded bg-brand px-4 py-2 text-xs font-semibold text-stone-950 transition-colors hover:bg-brand-hover disabled:opacity-50"
      >
        {submitting ? 'Saving…' : 'Save'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
      >
        Cancel
      </button>
    </div>
  );
}

function SectionFields({
  section,
  data,
  set,
}: {
  section: ProspectSection;
  data: Record<string, unknown>;
  set: (key: string, value: unknown) => void;
}) {
  return (
    <Section title={section.title}>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {section.fields.map((f) => (
          <FieldInput key={f.key} field={f} value={data[f.key]} set={set} />
        ))}
      </div>
    </Section>
  );
}

function FieldInput({
  field,
  value,
  set,
}: {
  field: ProspectField;
  value: unknown;
  set: (key: string, value: unknown) => void;
}) {
  const str = typeof value === 'string' ? value : '';

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 self-end pb-1.5">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => set(field.key, e.target.checked)}
          className="size-3.5 rounded border-stone-300 text-brand-dark focus:ring-brand/20"
        />
        <span className="text-label font-semibold text-stone-600">{field.label}</span>
      </label>
    );
  }

  return (
    <FieldShell label={field.label} required={field.required}>
      {field.type === 'textarea' ? (
        <textarea
          name={field.key}
          rows={3}
          required={field.required}
          value={str}
          onChange={(e) => set(field.key, e.target.value)}
          className={`${inputClass} resize-none`}
        />
      ) : field.type === 'select' ? (
        <select
          name={field.key}
          required={field.required}
          value={str}
          onChange={(e) => set(field.key, e.target.value)}
          className={inputClass}
        >
          <option value="">— Select —</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          name={field.key}
          type={field.type === 'number' ? 'number' : field.type ?? 'text'}
          required={field.required}
          readOnly={field.readOnly}
          placeholder={field.placeholder}
          value={str}
          onChange={(e) => set(field.key, e.target.value)}
          className={inputClass}
        />
      )}
    </FieldShell>
  );
}
