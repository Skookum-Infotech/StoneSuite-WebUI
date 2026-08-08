import { describe, it, expect } from 'vitest';
import { sidebarNav } from './sidebarNav';
import type { NavEntry, NavLink } from './sidebarNav';

/** Every leaf link in the tree, with a readable trail for failure messages. */
function allLinks(): { link: NavLink; trail: string }[] {
  const out: { link: NavLink; trail: string }[] = [];
  const visit = (entry: NavEntry, trail: string) => {
    if (entry.type === 'link') {
      out.push({ link: entry, trail: `${trail} > ${entry.label}` });
      return;
    }
    for (const child of entry.children) visit(child, `${trail} > ${entry.label}`);
  };
  for (const item of sidebarNav.topItems) visit(item, 'topItems');
  for (const section of sidebarNav.sections) {
    for (const entry of section.entries) visit(entry, section.label);
  }
  return out;
}

describe('sidebarNav access declarations', () => {
  // The guard that matters. Sidebar.canShowLink fails closed on an undeclared
  // permission, so a link missing one silently disappears instead of silently
  // over-exposing — but either way it is a bug, and this catches it at the
  // config layer where the fix belongs.
  it('every link declares a permission, alwaysVisible, or platformAdminOnly', () => {
    const undeclared = allLinks()
      .filter(({ link }) => !link.permission && !link.alwaysVisible && !link.platformAdminOnly)
      .map(({ trail }) => trail);

    expect(undeclared, `Links with no access declaration:\n  ${undeclared.join('\n  ')}`).toEqual([]);
  });

  it('declared permissions use snake_case resources and known actions', () => {
    const actions = ['create', 'read', 'update', 'delete', 'transition', 'approve', 'configure'];
    for (const { link, trail } of allLinks()) {
      if (!link.permission) continue;
      expect(link.permission.resource, `${trail} resource`).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(actions, `${trail} action`).toContain(link.permission.action);
    }
  });

  it('does not mark a link both alwaysVisible and permission-gated', () => {
    const both = allLinks()
      .filter(({ link }) => link.alwaysVisible && link.permission)
      .map(({ trail }) => trail);

    expect(both, `Contradictory declarations:\n  ${both.join('\n  ')}`).toEqual([]);
  });

  it('ids are unique so React keys and open-state tracking stay stable', () => {
    const ids = allLinks().map(({ link }) => link.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });
});
