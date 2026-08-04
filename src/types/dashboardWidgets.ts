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

export interface UserWidgetSettings {
  userId: string;
  allocated: string[];
  enabled: string[];
}
