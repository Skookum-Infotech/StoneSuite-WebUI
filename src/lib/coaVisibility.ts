// Shared visibility-action logic for Chart of Accounts rows (single-row and
// bulk). chk_coa_visibility (schema.sql) forbids an active+hidden account —
// "isActive: true + isVisible: false is rejected by a CHECK. Never offer
// that combination." Bundling isActive:false into every "hide" payload means
// the UI can never construct that combination, regardless of the account's
// current state.
export type VisibilityAction = 'activate' | 'deactivate' | 'show' | 'hide';

export const VISIBILITY_ACTION_LABELS: Record<VisibilityAction, string> = {
  activate: 'Activate',
  deactivate: 'Deactivate',
  show: 'Show',
  hide: 'Hide',
};

export interface VisibilityPayload {
  isActive?: boolean;
  isVisible?: boolean;
}

/** The isActive/isVisible fields to PATCH for a visibility action. */
export function visibilityPayload(action: VisibilityAction): VisibilityPayload {
  switch (action) {
    case 'activate': return { isActive: true };
    case 'deactivate': return { isActive: false };
    case 'show': return { isVisible: true };
    case 'hide': return { isActive: false, isVisible: false };
  }
}

/** Which visibility actions are meaningful for an account in its current
 *  state — omits actions that would be a no-op (e.g. "Activate" on an
 *  already-active account). (true, false) — active+hidden — cannot occur. */
export function applicableVisibilityActions(account: { isActive: boolean; isVisible: boolean }): VisibilityAction[] {
  const actions: VisibilityAction[] = [];
  if (!account.isActive) actions.push('activate');
  if (account.isActive) actions.push('deactivate');
  if (!account.isVisible) actions.push('show');
  if (account.isVisible) actions.push('hide');
  return actions;
}
