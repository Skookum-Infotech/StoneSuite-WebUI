import type { LucideIcon } from 'lucide-react';
import { sidebarNav } from '@/config/sidebarNav';

export interface ResourceRow {
  id: string;
  resource: string;
  label: string;
}

export interface PermModule {
  id: string;
  label: string;
  icon: LucideIcon;
  rows: ResourceRow[];
}

/**
 * Builds the module/row layout for the role permission matrix (create, edit,
 * and read-only views) from the sidebar nav tree.
 *
 * A resource is only ever added once, first occurrence wins. Some nav links
 * reuse another resource purely to gate their own sidebar visibility (e.g.
 * "Import Data" gates on `lead:create` — see sidebarNav.ts) rather than
 * naming a distinct backend resource. Without dedup, that link would render
 * as a second matrix row for the same resource; granting actions there
 * silently grants them on the resource's "real" row too (e.g. checking
 * "Import Data" would also check off "Leads"), and a role's saved
 * permissions then show grants the admin never selected on the row they
 * were looking at.
 */
export function buildPermModules(): PermModule[] {
  const out: PermModule[] = [];
  const seenResources = new Set<string>();
  for (const section of sidebarNav.sections) {
    if (section.platformAdminOnly) continue;
    for (const entry of section.entries) {
      if (entry.type === 'link') {
        if (!entry.permission || entry.platformAdminOnly) continue;
        if (seenResources.has(entry.permission.resource)) continue;
        seenResources.add(entry.permission.resource);
        out.push({
          id: entry.id,
          label: entry.label,
          icon: entry.icon,
          rows: [
            {
              id: entry.id,
              resource: entry.permission.resource,
              label: entry.label,
            },
          ],
        });
        continue;
      }
      const rows: ResourceRow[] = [];
      for (const child of entry.children) {
        if (!child.permission || child.platformAdminOnly) continue;
        if (seenResources.has(child.permission.resource)) continue;
        seenResources.add(child.permission.resource);
        rows.push({
          id: child.id,
          resource: child.permission.resource,
          label: child.label,
        });
      }
      if (rows.length)
        out.push({ id: entry.id, label: entry.label, icon: entry.icon, rows });
    }
  }
  return out;
}
