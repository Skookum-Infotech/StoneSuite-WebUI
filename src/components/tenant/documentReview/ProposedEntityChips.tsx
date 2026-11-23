import * as React from 'react';
import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ProposedEntityChip } from './ProposedEntityChip';
import { PROPOSED_ENTITY_STRINGS as S } from './proposedEntityStrings';
import type { ProposedEntityView } from '@/types/documentExtraction';
import type { ProposedActionResultRef } from '@/types/proposedAction';

interface ProposedEntityChipsProps {
  extractionId: string | null | undefined;
  entities: readonly ProposedEntityView[] | undefined;
  /** Called once a record was created from a chip, so the form can select it. */
  onCreated: (entity: ProposedEntityView, ref: ProposedActionResultRef) => void;
}

/** The group of "proposed new record" chips for one place on the review screen
 *  (the party row, or one line). Renders nothing when the feature is off
 *  (no entities). A chip whose entity disappears after creation (the refetch
 *  resolved it) stays as a "Created ..." note so the outcome is not lost. */
export function ProposedEntityChips({ extractionId, entities, onCreated }: ProposedEntityChipsProps): React.JSX.Element | null {
  const [createdByKey, setCreatedByKey] = useState<Record<string, ProposedActionResultRef>>({});
  const list = entities ?? [];
  const present = new Set(list.map((e) => e.key));
  const orphans = Object.entries(createdByKey).filter(([key]) => !present.has(key));
  if (!extractionId || (list.length === 0 && orphans.length === 0)) return null;
  return (
    <ul aria-label={S.groupLabel} className="space-y-1.5">
      {list.map((entity) => (
        <ProposedEntityChip
          key={entity.key}
          extractionId={extractionId}
          entity={entity}
          onCreated={(e, ref) => {
            setCreatedByKey((prev) => ({ ...prev, [e.key]: ref }));
            onCreated(e, ref);
          }}
        />
      ))}
      {orphans.map(([key, ref]) => (
        <li key={key} role="status" className="flex list-none items-center gap-1.5 text-xs font-medium text-accent-foreground">
          <CheckCircle2 className="size-3.5" aria-hidden={true} />
          {S.createdPrefix} {ref.label}
        </li>
      ))}
    </ul>
  );
}
