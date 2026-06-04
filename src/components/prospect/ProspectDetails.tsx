import { useState } from 'react';
import {
  PRIMARY_SECTIONS,
  TABS,
  type ProspectField,
  type ProspectSection,
} from '@/lib/prospectForm';
import { Section, FieldShell, TabBar } from '@/components/prospect/prospectUi';

/** Read-only rendering of a prospect's stored fields, mirroring the form layout. */
export function ProspectDetails({ fields }: { fields: Record<string, unknown> }) {
  const [activeTab, setActiveTab] = useState(TABS[0]?.key ?? '');
  const tab = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  return (
    <div className="space-y-3">
      {PRIMARY_SECTIONS.map((section) => (
        <ReadSection key={section.title} section={section} fields={fields} />
      ))}

      <div className="rounded border border-stone-200 bg-white">
        <TabBar tabs={TABS} active={tab.key} onSelect={setActiveTab} />
        <div className="space-y-3 p-3">
          {tab.sections.map((section) => (
            <ReadSection key={section.title} section={section} fields={fields} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ReadSection({
  section,
  fields,
}: {
  section: ProspectSection;
  fields: Record<string, unknown>;
}) {
  return (
    <Section title={section.title}>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {section.fields.map((f) => (
          <ReadField key={f.key} field={f} value={fields[f.key]} />
        ))}
      </div>
    </Section>
  );
}

function ReadField({ field, value }: { field: ProspectField; value: unknown }) {
  let display: string;
  if (field.type === 'checkbox') {
    display = value === true ? 'Yes' : 'No';
  } else if (typeof value === 'string' && value.trim() !== '') {
    display = value;
  } else if (typeof value === 'number') {
    display = String(value);
  } else {
    display = '—';
  }

  return (
    <FieldShell label={field.label}>
      <p className="min-h-[1.5rem] whitespace-pre-wrap break-words text-xs text-stone-800">{display}</p>
    </FieldShell>
  );
}
