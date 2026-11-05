import type { StagePalette, WorkflowStageView } from '@/lib/workflowStages';

/** Neutral stone grey, for a stage with no palette of its own. */
export const NEUTRAL_PALETTE: StagePalette = { tint: '#f7f7f7', ring: '#a8a29e', ink: '#6b6560' };
const VOID_PALETTE: StagePalette = { tint: '#fff1f2', ring: '#ef4444', ink: '#be123c' };

/** The palette a stage draws with: its own, red when it holds a void record. */
export function stagePalette(stage: WorkflowStageView): StagePalette {
  return stage.state === 'void' ? VOID_PALETTE : stage.color ?? NEUTRAL_PALETTE;
}
