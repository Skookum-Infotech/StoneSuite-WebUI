/** Version-two production stages; legacy jobs retain their existing status. */
export type PieceStage = 'planned' | 'ready_cutting' | 'cutting' | 'edging' | 'qc' | 'qc_passed' | 'handed_over' | 'installed' | 'signed_off';
export type DeliveryMode = 'supply_only' | 'installed';
export interface CommandMeta { expectedVersion: number; requestId: string }
export interface ActionBlocker { code: string; message: string; targetId?: string }
export interface AvailableAction { code: string; label: string; enabled: boolean; inputType: string; blockers: ActionBlocker[] }
export interface ProgressSummary { requiredPieces: number; completedPieces: number; stageCounts: Partial<Record<PieceStage, number>>; complete: boolean }
