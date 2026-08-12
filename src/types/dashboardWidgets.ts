export type WidgetCategory = 'core' | 'sales' | 'operations' | 'finance';
export type WidgetSize = 'full' | 'half' | 'third';

export interface WidgetDefinition {
  id: string;
  title: string;
  description: string;
  category: WidgetCategory;
  size: WidgetSize;
  defaultEnabled: boolean;
}

// Admin decision — which widgets a role's members may see.
export interface RoleWidgetAllocation {
  roleId: string;
  allocated: string[];
}

// End-user decision — widgets the user has personally hidden from their own
// dashboard. Opt-out (not opt-in) so a widget newly allocated to a role the
// user hasn't touched before shows up immediately.
export interface UserWidgetPreference {
  userId: string;
  hidden: string[];
}
