// A user's daily digest preferences — GET/PUT /api/tenant/automation/digest/me
// (automation.DigestPrefs on the backend). No row yet means the defaults, digest off.
export interface DigestPrefs {
  enabled: boolean;
  /** Tenant-local hour (8..17) the digest is sent from. */
  sendHour: number;
  includeInstalls: boolean;
  includeVendorBills: boolean;
  includeApprovals: boolean;
  /** Skip a day on which there is nothing to report. */
  skipEmpty: boolean;
}
