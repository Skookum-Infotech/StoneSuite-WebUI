// Mirrors the backend's controllers.AutomationSettings (automation_settings_store.go).
export interface AutomationSettings {
  killSwitch: boolean;
  dailyExternalCap: number;
  perContactWeeklyCap: number;
  updatedAt: string | null;
  /** The platform-wide scheduler switch; null when the server could not read it. */
  platformEnabled: boolean | null;
}
