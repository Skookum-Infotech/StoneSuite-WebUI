// Subscription module — UI-only mock types for the Subscription Management
// mockup page. No backend contract exists yet; this repo has no server code
// (see CLAUDE.md), so these shapes exist purely to drive the hardcoded
// mock data rendered by src/pages/subscription/*.

export type PlanId = 'starter' | 'pro' | 'enterprise';

export interface PlanTier {
  id: PlanId;
  name: string;
  pricePerMonth: number | null;
  pricePerYear: number | null;
  features: string[];
  highlighted: boolean;
}

export type InvoiceStatus = 'paid' | 'pending' | 'overdue';

export interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: InvoiceStatus;
}

export type CardBrand = 'Visa' | 'Mastercard' | 'Amex';

export interface PaymentMethod {
  id: string;
  brand: CardBrand;
  last4: string;
  expiry: string;
  isDefault: boolean;
}

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

export interface CurrentPlan {
  tier: PlanTier;
  renewalDate: string;
  status: SubscriptionStatus;
}

export type CancelReason = 'too_expensive' | 'missing_features' | 'switching_tools' | 'other';

export interface BillingContact {
  name: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// ── Usage (real API contract) ───────────────────────────────────────────────
// Unlike the mock shapes above, these mirror the backend's
// GET /api/tenant/subscription/usage response (StoneSuite-Backend
// controllers/subscription_usage.go). Limits are null until subscription
// plans carry them; a non-null limit is what turns a meter into a progress bar.

/** Size of the tenant's own R2 bucket, as last measured. */
export interface StorageUsage {
  usedBytes: number;
  objectCount: number;
  /** ISO timestamp of the measurement; null when never measured. */
  measuredAt: string | null;
  limitBytes: number | null;
}

/** One row of the per-feature token breakdown (largest first). */
export interface TokenUsageBySource {
  /** Backend source key — ask, route, report_interpret, doc_extract, import, other. */
  source: string;
  totalTokens: number;
}

/** LLM tokens spent on the self-hosted Ollama this billing period. */
export interface AiTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  limitTokens: number | null;
  bySource: TokenUsageBySource[];
}

export interface SubscriptionUsage {
  /** Billing period start, `yyyy-mm-dd` (UTC). */
  periodStart: string;
  /** Billing period end, `yyyy-mm-dd` (UTC), exclusive. */
  periodEnd: string;
  storage: StorageUsage;
  aiTokens: AiTokenUsage;
}
