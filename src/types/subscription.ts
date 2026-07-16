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
  brand: CardBrand;
  last4: string;
  expiry: string;
}

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

export interface CurrentPlan {
  tier: PlanTier;
  renewalDate: string;
  status: SubscriptionStatus;
}
