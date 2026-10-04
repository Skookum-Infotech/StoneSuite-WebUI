import type { AvailableAction, CommandMeta } from './fabricationActions';
export interface MeasuredPiece { name: string; lengthMm: number; widthMm: number; thicknessMm: number }
export interface TemplateLine { sourceLineId: string; materialId: string; finish?: string; quantity: number; unitPrice: number; scope: string; pieces: MeasuredPiece[] }
export interface TemplateChange { internalRequired: boolean; customerRequired: boolean; changedLines: string[] }
export interface TemplateRevision { availableActions?: AvailableAction[]; jobVersion: number; id: string; revision: number; salesOrderVersion: number; state: 'submitted' | 'approved' | 'rejected' | 'superseded'; baseline: TemplateLine[]; lines: TemplateLine[]; change: TemplateChange; createdAt: string }
export interface SubmitTemplateInput extends CommandMeta { salesOrderVersion: number; lines: TemplateLine[] }
