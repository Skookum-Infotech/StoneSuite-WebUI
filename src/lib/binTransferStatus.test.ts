import { describe, it, expect } from 'vitest';
import {
  BT_STATUS_CODES, BT_STATUS_COLORS, btStatusLabel, btTransitionLabel, btProgress, btActions, btIsEditable,
} from './binTransferStatus';

describe('status vocabulary', () => {
  it('labels every seeded status and falls back to the code', () => {
    expect(BT_STATUS_CODES.map((s) => s.code)).toEqual(['DRFT', 'PAPV', 'APPV', 'COMP', 'CANC']);
    expect(btStatusLabel('PAPV')).toBe('Pending Approval');
    expect(btStatusLabel('COMP')).toBe('Completed');
    expect(btStatusLabel('ZZZZ')).toBe('ZZZZ');
  });

  it('gives every status a colour', () => {
    for (const { code } of BT_STATUS_CODES) expect(BT_STATUS_COLORS[code]).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('only a draft is editable — approval freezes the document', () => {
    expect(btIsEditable('DRFT')).toBe(true);
    for (const code of ['PAPV', 'APPV', 'COMP', 'CANC']) expect(btIsEditable(code)).toBe(false);
  });
});

describe('btTransitionLabel', () => {
  it.each([
    ['DRFT', 'PAPV', 'Submit for Approval'],
    ['DRFT', 'COMP', 'Complete'],
    ['DRFT', 'CANC', 'Cancel Transfer'],
    ['PAPV', 'APPV', 'Approve'],
    ['PAPV', 'DRFT', 'Return to Draft'],
    ['APPV', 'COMP', 'Complete'],
    ['APPV', 'DRFT', 'Revise'],
    ['APPV', 'CANC', 'Cancel Transfer'],
  ])('%s → %s reads "%s"', (from, to, label) => {
    expect(btTransitionLabel(from, to)).toBe(label);
  });

  it('falls back to a plain "Move to …" for an unknown pair', () => {
    expect(btTransitionLabel('COMP', 'DRFT')).toBe('Move to Draft');
  });
});

describe('btProgress', () => {
  const states = (code: string) => btProgress(code).steps.map((s) => s.state);

  it('walks the four steps as the transfer advances', () => {
    expect(states('DRFT')).toEqual(['current', 'upcoming', 'upcoming', 'upcoming']);
    expect(states('PAPV')).toEqual(['done', 'current', 'upcoming', 'upcoming']);
    expect(states('APPV')).toEqual(['done', 'done', 'current', 'upcoming']);
    expect(states('COMP')).toEqual(['done', 'done', 'done', 'done']);
  });

  it('keeps the four steps in order with their labels', () => {
    expect(btProgress('DRFT').steps.map((s) => s.label)).toEqual(['Draft', 'Pending Approval', 'Approved', 'Completed']);
  });

  it('shows a cancelled transfer as stopped, not as progress', () => {
    const p = btProgress('CANC');
    expect(p.cancelled).toBe(true);
    expect(p.steps.every((s) => s.state === 'upcoming')).toBe(true);
    expect(btProgress('APPV').cancelled).toBe(false);
  });
});

describe('btActions', () => {
  const to = (code: string, next: string[], gated: boolean) => btActions(code, next, gated).map((a) => a.to);

  it('offers Submit and Cancel on a draft while an approver is configured', () => {
    expect(to('DRFT', ['CANC', 'PAPV'], false)).toEqual(['PAPV', 'CANC']);
  });

  it('offers Complete straight from a draft when nobody is configured', () => {
    expect(to('DRFT', ['CANC', 'COMP'], false)).toEqual(['COMP', 'CANC']);
  });

  // Approve and Reject are the approvers' own controls (the approval banner);
  // sending a pending transfer back by hand is refused server-side while gated.
  it('leaves only Cancel on a pending transfer that is still gated', () => {
    expect(to('PAPV', ['APPV', 'CANC', 'DRFT'], true)).toEqual(['CANC']);
  });

  it('offers a manual Approve and Return to Draft once nobody is left to approve', () => {
    expect(to('PAPV', ['APPV', 'CANC', 'DRFT'], false)).toEqual(['APPV', 'DRFT', 'CANC']);
  });

  it('puts Complete first on an approved transfer, then Revise, then Cancel', () => {
    expect(to('APPV', ['CANC', 'COMP', 'DRFT'], false)).toEqual(['COMP', 'DRFT', 'CANC']);
  });

  it('offers nothing on a finished transfer', () => {
    expect(btActions('COMP', [], false)).toEqual([]);
    expect(btActions('CANC', [], false)).toEqual([]);
  });

  it('marks the grant each action needs and how it should look', () => {
    const [complete, revise, cancel] = btActions('APPV', ['CANC', 'COMP', 'DRFT'], false);
    expect(complete).toMatchObject({ to: 'COMP', kind: 'primary', permission: 'transition' });
    expect(revise).toMatchObject({ to: 'DRFT', kind: 'secondary', permission: 'transition' });
    expect(cancel).toMatchObject({ to: 'CANC', kind: 'danger', permission: 'transition' });

    const [approve] = btActions('PAPV', ['APPV'], false);
    expect(approve).toMatchObject({ to: 'APPV', kind: 'primary', permission: 'approve' });
  });
});
