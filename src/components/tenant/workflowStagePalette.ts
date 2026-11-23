import type { StagePalette, WorkflowStageView } from '@/lib/workflowStages';

/** Neutral stone grey, for a stage with no palette of its own. */
export const NEUTRAL_PALETTE: StagePalette = { tint: '#f7f7f7', ring: '#a8a29e', ink: '#6b6560' };
const VOID_PALETTE: StagePalette = { tint: '#fff1f2', ring: '#ef4444', ink: '#be123c' };

/** The palette a stage draws with: its own, red when it holds a void record. */
export function stagePalette(stage: WorkflowStageView): StagePalette {
  return stage.state === 'void' ? VOID_PALETTE : stage.color ?? NEUTRAL_PALETTE;
}

/** Colour of the line below stage `idx`, or undefined to leave it grey. The line
 *  is drawn when the flow has actually reached a stage at or above it and one
 *  below it, so a Sales order that became an Invoice lights the whole run
 *  between them (the skipped Fabrication and Installation markers stay grey,
 *  only the line passes through). It takes the nearest reached stage's colour. */
export function connectorColor(stages: WorkflowStageView[], idx: number): string | undefined {
  const reached = (s: WorkflowStageView) => s.state !== 'upcoming';
  if (!stages.slice(idx + 1).some(reached)) return undefined;
  for (let i = idx; i >= 0; i -= 1) {
    if (reached(stages[i])) return stagePalette(stages[i]).ring;
  }
  return undefined;
}
