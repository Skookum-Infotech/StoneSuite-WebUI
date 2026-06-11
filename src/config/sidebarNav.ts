import {
  LayoutDashboard,
  Building2,
  Sparkles,
  Users,
  SlidersHorizontal,
  Workflow as WorkflowIcon,
  ShieldCheck,
  UserPlus,
  UsersRound,
  Hash,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavPermission {
  resource: string;
  action: string;
}

export interface NavLink {
  type: 'link';
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  permission?: NavPermission;
  platformAdminOnly?: boolean;
}

export interface NavGroup {
  type: 'group';
  id: string;
  label: string;
  icon: LucideIcon;
  matchPaths: string[];
  children: NavLink[];
  permission?: NavPermission;
  platformAdminOnly?: boolean;
}

export type NavEntry = NavLink | NavGroup;

export interface NavSection {
  id: string;
  label: string;
  entries: NavEntry[];
  platformAdminOnly?: boolean;
}

export interface SidebarNavConfig {
  topItems: NavLink[];
  sections: NavSection[];
}

// Add new nav items here — no changes to Sidebar.tsx required.
// Each item declares its required permission; the sidebar hides items
// the signed-in user does not have a grant for.
export const sidebarNav: SidebarNavConfig = {
  topItems: [
    {
      type: 'link',
      id: 'dashboard',
      label: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
    },
  ],
  sections: [
    {
      id: 'workspace',
      label: 'Workspace',
      entries: [
        {
          type: 'group',
          id: 'crm',
          label: 'CRM',
          icon: Building2,
          matchPaths: ['/crm', '/prospects'],
          children: [
            {
              type: 'link',
              id: 'leads',
              label: 'Leads',
              path: '/crm/lead',
              icon: Sparkles,
              permission: { resource: 'lead', action: 'read' },
            },
            {
              type: 'link',
              id: 'prospects',
              label: 'Prospects',
              path: '/prospects',
              icon: Users,
              permission: { resource: 'prospect', action: 'read' },
            },
            {
              type: 'link',
              id: 'customers',
              label: 'Customers',
              path: '/crm/customer',
              icon: Building2,
              permission: { resource: 'customer', action: 'read' },
            },
          ],
        },
      ],
    },
    {
      id: 'configure',
      label: 'Configure',
      entries: [
        {
          type: 'group',
          id: 'configuration',
          label: 'Configuration',
          icon: SlidersHorizontal,
          matchPaths: ['/config'],
          children: [
            {
              type: 'link',
              id: 'workflows',
              label: 'Workflows',
              path: '/config/workflows',
              icon: WorkflowIcon,
              permission: { resource: 'workflow', action: 'read' },
            },
            {
              type: 'link',
              id: 'roles-access',
              label: 'Roles & Access',
              path: '/config/roles',
              icon: ShieldCheck,
              permission: { resource: 'role', action: 'read' },
            },
            {
              type: 'link',
              id: 'users',
              label: 'Users',
              path: '/config/users',
              icon: UsersRound,
              permission: { resource: 'user', action: 'read' },
            },
            {
              type: 'link',
              id: 'record-numbering',
              label: 'Record Numbering',
              path: '/config/record-numbering',
              icon: Hash,
              permission: { resource: 'workflow_config', action: 'configure' },
            },
          ],
        },
      ],
    },
    {
      id: 'platform',
      label: 'Platform',
      platformAdminOnly: true,
      entries: [
        {
          type: 'link',
          id: 'onboarding',
          label: 'Onboarding',
          path: '/customer/onboarding',
          icon: UserPlus,
          platformAdminOnly: true,
        },
      ],
    },
  ],
};
