import { useState } from 'react';
import { Section, FieldShell, inputClass, TabBar } from '@/components/prospect/ProspectUI';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import type { FieldDefinition } from '@/types/tenant';

type CoreProps = {
  fields: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
};

type CustomProps = {
  defs: FieldDefinition[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
};

type Props = {
  core: CoreProps;
  custom: CustomProps;
  statusNode: React.ReactNode;
};

// ── Shared primitives ──────────────────────────────────────────────────────────

function Sel({
  value,
  onChange,
  options,
  required,
  placeholder = '—',
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <select
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Check({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 pt-5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 cursor-pointer rounded border-stone-300 accent-brand"
      />
      <label htmlFor={id} className="cursor-pointer select-none text-xs font-medium text-stone-600">
        {label}
      </label>
    </div>
  );
}

/** Lightweight sub-section header used inside tab panels. */
function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 overflow-hidden rounded border border-stone-200">
      <div className="border-b border-stone-200 bg-stone-100 px-3 py-1.5">
        <h4 className="text-2xs font-bold uppercase tracking-wide text-stone-600">{title}</h4>
      </div>
      <div className="px-3 py-3">{children}</div>
    </div>
  );
}

// ── Tab definitions ────────────────────────────────────────────────────────────

const TABS = [
  { key: 'sales',            label: 'Sales' },
  { key: 'financial',        label: 'Financial' },
  { key: 'subsidiaries',     label: 'Subsidiaries' },
  { key: 'address',          label: 'Address' },
  { key: 'relationships',    label: 'Relationships' },
  { key: 'communication',    label: 'Communication' },
  { key: 'zab',              label: 'ZAB Subscriptions' },
  { key: 'zuora_sync',       label: 'Zuora Sync Details' },
  { key: 'zuora_account',    label: 'Zuora Account' },
  { key: 'stripe',           label: 'Stripe' },
  { key: 'cch',              label: 'CCH® SureTax®' },
  { key: 'edocument',        label: 'E-Document' },
  { key: 'custom',           label: 'Custom' },
  { key: 'preferences',      label: 'Preferences' },
  { key: 'sfdc',             label: 'SFDC' },
];

// ── Tab panels ─────────────────────────────────────────────────────────────────

function SalesPanel({ s, on }: { s: Record<string, unknown>; on: (k: string, v: unknown) => void }) {
  const str = (k: string) => String(s[k] ?? '');
  const bool = (k: string) => Boolean(s[k]);
  return (
    <div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
        <FieldShell label="Territory">
          <Sel
            value={str('territory')}
            onChange={(v) => on('territory', v)}
            options={['North America', 'EMEA', 'APAC', 'LATAM', 'Global']}
          />
        </FieldShell>
      </div>
      <SubSection title="Qualification">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
          <FieldShell label="Estimated Budget">
            <input value={str('estimated_budget')} onChange={(e) => on('estimated_budget', e.target.value)} className={inputClass} placeholder="e.g. 50000" />
          </FieldShell>
          <FieldShell label="Buying Reason">
            <Sel value={str('buying_reason')} onChange={(v) => on('buying_reason', v)} options={['New Business', 'Expansion', 'Renewal', 'Replacement', 'Cost Savings']} />
          </FieldShell>
          <Check id="budget_approved" checked={bool('budget_approved')} onChange={(v) => on('budget_approved', v)} label="Budget Approved" />
          <FieldShell label="Buying Time Frame">
            <Sel value={str('buying_time_frame')} onChange={(v) => on('buying_time_frame', v)} options={['Immediate', '1-3 Months', '3-6 Months', '6-12 Months', '12+ Months']} />
          </FieldShell>
          <FieldShell label="Sales Readiness">
            <Sel value={str('sales_readiness')} onChange={(v) => on('sales_readiness', v)} options={['Not Ready', 'Evaluating', 'Ready to Buy', 'Negotiating']} />
          </FieldShell>
        </div>
      </SubSection>
    </div>
  );
}

function FinancialPanel({ s, on }: { s: Record<string, unknown>; on: (k: string, v: unknown) => void }) {
  const str = (k: string) => String(s[k] ?? '');
  const bool = (k: string) => Boolean(s[k]);
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
      <FieldShell label="Credit Limit">
        <input type="number" value={str('credit_limit')} onChange={(e) => on('credit_limit', e.target.value)} className={inputClass} placeholder="0.00" />
      </FieldShell>
      <FieldShell label="Payment Terms">
        <Sel value={str('payment_terms')} onChange={(v) => on('payment_terms', v)} options={['Net 15', 'Net 30', 'Net 60', 'Net 90', 'Due on Receipt']} />
      </FieldShell>
      <FieldShell label="Currency">
        <Sel value={str('currency')} onChange={(v) => on('currency', v)} options={['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']} />
      </FieldShell>
      <FieldShell label="Tax Registration Number">
        <input value={str('tax_registration_number')} onChange={(e) => on('tax_registration_number', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Default Payment Method">
        <Sel value={str('default_payment_method')} onChange={(v) => on('default_payment_method', v)} options={['Credit Card', 'ACH', 'Check', 'Wire Transfer']} />
      </FieldShell>
      <FieldShell label="AR Account">
        <input value={str('ar_account')} onChange={(e) => on('ar_account', e.target.value)} className={inputClass} />
      </FieldShell>
      <Check id="credit_hold" checked={bool('credit_hold')} onChange={(v) => on('credit_hold', v)} label="Credit Hold" />
      <FieldShell label="Dunning Procedure">
        <Sel value={str('dunning_procedure')} onChange={(v) => on('dunning_procedure', v)} options={['Standard', 'Gentle', 'Aggressive', 'None']} />
      </FieldShell>
    </div>
  );
}

function SubsidiariesPanel({ s, on }: { s: Record<string, unknown>; on: (k: string, v: unknown) => void }) {
  const str = (k: string) => String(s[k] ?? '');
  const bool = (k: string) => Boolean(s[k]);
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
      <FieldShell label="Primary Subsidiary">
        <Sel value={str('primary_subsidiary')} onChange={(v) => on('primary_subsidiary', v)} options={['Main', 'US', 'UK', 'EU', 'APAC', 'LATAM']} />
      </FieldShell>
      <FieldShell label="Secondary Subsidiaries">
        <input value={str('secondary_subsidiaries')} onChange={(e) => on('secondary_subsidiaries', e.target.value)} className={inputClass} placeholder="Comma-separated" />
      </FieldShell>
      <FieldShell label="Eliminations Account">
        <input value={str('eliminations_account')} onChange={(e) => on('eliminations_account', e.target.value)} className={inputClass} />
      </FieldShell>
      <Check id="intercompany_account" checked={bool('intercompany_account')} onChange={(v) => on('intercompany_account', v)} label="Intercompany Account" />
      <Check id="transfer_price" checked={bool('transfer_price')} onChange={(v) => on('transfer_price', v)} label="Transfer Price" />
    </div>
  );
}

function AddressPanel({ s, on }: { s: Record<string, unknown>; on: (k: string, v: unknown) => void }) {
  const str = (k: string) => String(s[k] ?? '');
  const bool = (k: string) => Boolean(s[k]);
  return (
    <div>
      <SubSection title="Billing Address">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
          <FieldShell label="Address Line 1">
            <input value={str('billing_addr1')} onChange={(e) => on('billing_addr1', e.target.value)} className={inputClass} />
          </FieldShell>
          <FieldShell label="Address Line 2">
            <input value={str('billing_addr2')} onChange={(e) => on('billing_addr2', e.target.value)} className={inputClass} />
          </FieldShell>
          <FieldShell label="City">
            <input value={str('billing_city')} onChange={(e) => on('billing_city', e.target.value)} className={inputClass} />
          </FieldShell>
          <FieldShell label="State / Province">
            <input value={str('billing_state')} onChange={(e) => on('billing_state', e.target.value)} className={inputClass} />
          </FieldShell>
          <FieldShell label="Zip / Postal Code">
            <input value={str('billing_zip')} onChange={(e) => on('billing_zip', e.target.value)} className={inputClass} />
          </FieldShell>
          <FieldShell label="Country">
            <Sel value={str('billing_country')} onChange={(v) => on('billing_country', v)} options={['United States', 'United Kingdom', 'Canada', 'Germany', 'France', 'Australia', 'Japan', 'Other']} />
          </FieldShell>
        </div>
      </SubSection>
      <SubSection title="Shipping Address">
        <div className="mb-2">
          <Check id="shipping_same_as_billing" checked={bool('shipping_same_as_billing')} onChange={(v) => on('shipping_same_as_billing', v)} label="Same as Billing Address" />
        </div>
        {!bool('shipping_same_as_billing') && (
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
            <FieldShell label="Address Line 1">
              <input value={str('shipping_addr1')} onChange={(e) => on('shipping_addr1', e.target.value)} className={inputClass} />
            </FieldShell>
            <FieldShell label="Address Line 2">
              <input value={str('shipping_addr2')} onChange={(e) => on('shipping_addr2', e.target.value)} className={inputClass} />
            </FieldShell>
            <FieldShell label="City">
              <input value={str('shipping_city')} onChange={(e) => on('shipping_city', e.target.value)} className={inputClass} />
            </FieldShell>
            <FieldShell label="State / Province">
              <input value={str('shipping_state')} onChange={(e) => on('shipping_state', e.target.value)} className={inputClass} />
            </FieldShell>
            <FieldShell label="Zip / Postal Code">
              <input value={str('shipping_zip')} onChange={(e) => on('shipping_zip', e.target.value)} className={inputClass} />
            </FieldShell>
            <FieldShell label="Country">
              <Sel value={str('shipping_country')} onChange={(v) => on('shipping_country', v)} options={['United States', 'United Kingdom', 'Canada', 'Germany', 'France', 'Australia', 'Japan', 'Other']} />
            </FieldShell>
          </div>
        )}
      </SubSection>
    </div>
  );
}

function RelationshipsPanel({ s, on }: { s: Record<string, unknown>; on: (k: string, v: unknown) => void }) {
  const str = (k: string) => String(s[k] ?? '');
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
      <FieldShell label="Account Manager">
        <input value={str('account_manager')} onChange={(e) => on('account_manager', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Sales Engineer">
        <input value={str('sales_engineer')} onChange={(e) => on('sales_engineer', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Partner Account">
        <input value={str('partner_account')} onChange={(e) => on('partner_account', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Referred By">
        <input value={str('referred_by')} onChange={(e) => on('referred_by', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Customer Since">
        <input type="date" value={str('customer_since')} onChange={(e) => on('customer_since', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Renewal Owner">
        <input value={str('renewal_owner')} onChange={(e) => on('renewal_owner', e.target.value)} className={inputClass} />
      </FieldShell>
    </div>
  );
}

function CommunicationPanel({ s, on }: { s: Record<string, unknown>; on: (k: string, v: unknown) => void }) {
  const str = (k: string) => String(s[k] ?? '');
  const bool = (k: string) => Boolean(s[k]);
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
      <FieldShell label="Preferred Contact Method">
        <Sel value={str('preferred_contact_method')} onChange={(v) => on('preferred_contact_method', v)} options={['Email', 'Phone', 'Slack', 'Teams']} />
      </FieldShell>
      <FieldShell label="Support Tier">
        <Sel value={str('support_tier')} onChange={(v) => on('support_tier', v)} options={['Standard', 'Premium', 'Enterprise', 'Dedicated']} />
      </FieldShell>
      <FieldShell label="Slack Channel">
        <input value={str('slack_channel')} onChange={(e) => on('slack_channel', e.target.value)} className={inputClass} placeholder="#customer-acme" />
      </FieldShell>
      <FieldShell label="Primary Contact Name">
        <input value={str('primary_contact_name')} onChange={(e) => on('primary_contact_name', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Primary Contact Email">
        <input type="email" value={str('primary_contact_email')} onChange={(e) => on('primary_contact_email', e.target.value)} className={inputClass} />
      </FieldShell>
      <Check id="newsletter" checked={bool('newsletter')} onChange={(v) => on('newsletter', v)} label="Newsletter Subscription" />
      <Check id="marketing_emails" checked={bool('marketing_emails')} onChange={(v) => on('marketing_emails', v)} label="Marketing Emails" />
      <Check id="nda_signed" checked={bool('nda_signed')} onChange={(v) => on('nda_signed', v)} label="NDA Signed" />
    </div>
  );
}

function ZabPanel({ s, on }: { s: Record<string, unknown>; on: (k: string, v: unknown) => void }) {
  const str = (k: string) => String(s[k] ?? '');
  const bool = (k: string) => Boolean(s[k]);
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
      <FieldShell label="Subscription ID">
        <input value={str('zab_subscription_id')} onChange={(e) => on('zab_subscription_id', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Plan Name">
        <Sel value={str('zab_plan_name')} onChange={(v) => on('zab_plan_name', v)} options={['Starter', 'Growth', 'Professional', 'Enterprise', 'Custom']} />
      </FieldShell>
      <FieldShell label="MRR">
        <input type="number" value={str('zab_mrr')} onChange={(e) => on('zab_mrr', e.target.value)} className={inputClass} placeholder="0.00" />
      </FieldShell>
      <FieldShell label="Contract Start Date">
        <input type="date" value={str('zab_contract_start')} onChange={(e) => on('zab_contract_start', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Contract End Date">
        <input type="date" value={str('zab_contract_end')} onChange={(e) => on('zab_contract_end', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Billing Frequency">
        <Sel value={str('zab_billing_frequency')} onChange={(v) => on('zab_billing_frequency', v)} options={['Monthly', 'Quarterly', 'Semi-Annual', 'Annual']} />
      </FieldShell>
      <Check id="zab_auto_renew" checked={bool('zab_auto_renew')} onChange={(v) => on('zab_auto_renew', v)} label="Auto Renew" />
    </div>
  );
}

function ZuoraSyncPanel({ s, on }: { s: Record<string, unknown>; on: (k: string, v: unknown) => void }) {
  const str = (k: string) => String(s[k] ?? '');
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
      <FieldShell label="Zuora Account ID">
        <input value={str('zuora_account_id')} onChange={(e) => on('zuora_account_id', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Sync Status">
        <Sel value={str('zuora_sync_status')} onChange={(v) => on('zuora_sync_status', v)} options={['Synced', 'Pending', 'Error', 'Not Configured']} />
      </FieldShell>
      <FieldShell label="Last Sync Date">
        <input type="date" value={str('zuora_last_sync')} onChange={(e) => on('zuora_last_sync', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Sync Error Message">
        <input value={str('zuora_sync_error')} onChange={(e) => on('zuora_sync_error', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Zuora Entity">
        <input value={str('zuora_entity')} onChange={(e) => on('zuora_entity', e.target.value)} className={inputClass} />
      </FieldShell>
    </div>
  );
}

function ZuoraAccountPanel({ s, on }: { s: Record<string, unknown>; on: (k: string, v: unknown) => void }) {
  const str = (k: string) => String(s[k] ?? '');
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
      <FieldShell label="Zuora Account Number">
        <input value={str('zuora_account_number')} onChange={(e) => on('zuora_account_number', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Invoice Owner">
        <input value={str('zuora_invoice_owner')} onChange={(e) => on('zuora_invoice_owner', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Payment Method ID">
        <input value={str('zuora_payment_method_id')} onChange={(e) => on('zuora_payment_method_id', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Bill Cycle Day">
        <Sel value={str('zuora_bill_cycle_day')} onChange={(v) => on('zuora_bill_cycle_day', v)} options={['1', '5', '10', '15', '20', '25', 'End of Month']} />
      </FieldShell>
      <FieldShell label="Batch">
        <Sel value={str('zuora_batch')} onChange={(v) => on('zuora_batch', v)} options={['Default', 'Batch1', 'Batch2', 'Batch3']} />
      </FieldShell>
    </div>
  );
}

function StripePanel({ s, on }: { s: Record<string, unknown>; on: (k: string, v: unknown) => void }) {
  const str = (k: string) => String(s[k] ?? '');
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
      <FieldShell label="Stripe Customer ID">
        <input value={str('stripe_customer_id')} onChange={(e) => on('stripe_customer_id', e.target.value)} className={inputClass} placeholder="cus_…" />
      </FieldShell>
      <FieldShell label="Stripe Subscription ID">
        <input value={str('stripe_subscription_id')} onChange={(e) => on('stripe_subscription_id', e.target.value)} className={inputClass} placeholder="sub_…" />
      </FieldShell>
      <FieldShell label="Stripe Status">
        <Sel value={str('stripe_status')} onChange={(v) => on('stripe_status', v)} options={['Active', 'Past Due', 'Canceled', 'Trialing', 'Incomplete']} />
      </FieldShell>
      <FieldShell label="Payment Method">
        <Sel value={str('stripe_payment_method')} onChange={(v) => on('stripe_payment_method', v)} options={['Card', 'ACH Debit', 'SEPA Debit', 'Bacs Debit']} />
      </FieldShell>
      <FieldShell label="Stripe Connect Account">
        <input value={str('stripe_connect_account')} onChange={(e) => on('stripe_connect_account', e.target.value)} className={inputClass} placeholder="acct_…" />
      </FieldShell>
    </div>
  );
}

function CchPanel({ s, on }: { s: Record<string, unknown>; on: (k: string, v: unknown) => void }) {
  const str = (k: string) => String(s[k] ?? '');
  const bool = (k: string) => Boolean(s[k]);
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
      <Check id="tax_exempt" checked={bool('tax_exempt')} onChange={(v) => on('tax_exempt', v)} label="Tax Exempt" />
      <FieldShell label="Exemption Certificate Number">
        <input value={str('exemption_cert_number')} onChange={(e) => on('exemption_cert_number', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Tax Classification">
        <Sel value={str('tax_classification')} onChange={(v) => on('tax_classification', v)} options={['Business', 'Non-Profit', 'Government', 'Reseller']} />
      </FieldShell>
      <FieldShell label="Nexus State">
        <input value={str('nexus_state')} onChange={(e) => on('nexus_state', e.target.value)} className={inputClass} placeholder="e.g. CA, NY" />
      </FieldShell>
      <FieldShell label="SureTax Customer Number">
        <input value={str('suretax_customer_number')} onChange={(e) => on('suretax_customer_number', e.target.value)} className={inputClass} />
      </FieldShell>
    </div>
  );
}

function EdocumentPanel({ s, on }: { s: Record<string, unknown>; on: (k: string, v: unknown) => void }) {
  const str = (k: string) => String(s[k] ?? '');
  const bool = (k: string) => Boolean(s[k]);
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
      <Check id="einvoice_enabled" checked={bool('einvoice_enabled')} onChange={(v) => on('einvoice_enabled', v)} label="E-Invoice Enabled" />
      <FieldShell label="E-Invoice Format">
        <Sel value={str('einvoice_format')} onChange={(v) => on('einvoice_format', v)} options={['UBL', 'PEPPOL', 'Factur-X', 'ZUGFeRD', 'OIOUBL']} />
      </FieldShell>
      <FieldShell label="Delivery Method">
        <Sel value={str('edoc_delivery_method')} onChange={(v) => on('edoc_delivery_method', v)} options={['Email', 'Portal', 'EDI', 'API']} />
      </FieldShell>
      <FieldShell label="E-Document Contact Email">
        <input type="email" value={str('edoc_contact_email')} onChange={(e) => on('edoc_contact_email', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Peppol ID">
        <input value={str('peppol_id')} onChange={(e) => on('peppol_id', e.target.value)} className={inputClass} />
      </FieldShell>
    </div>
  );
}

function CustomPanel({ s, on }: { s: Record<string, unknown>; on: (k: string, v: unknown) => void }) {
  const str = (k: string) => String(s[k] ?? '');
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
      <FieldShell label="Custom Field 1">
        <input value={str('custom_field_1')} onChange={(e) => on('custom_field_1', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Custom Field 2">
        <input value={str('custom_field_2')} onChange={(e) => on('custom_field_2', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Custom Field 3">
        <input value={str('custom_field_3')} onChange={(e) => on('custom_field_3', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="Custom Date">
        <input type="date" value={str('custom_date')} onChange={(e) => on('custom_date', e.target.value)} className={inputClass} />
      </FieldShell>
      <div className="sm:col-span-2">
        <FieldShell label="Custom Notes">
          <textarea rows={3} value={str('custom_notes')} onChange={(e) => on('custom_notes', e.target.value)} className={`${inputClass} resize-none`} />
        </FieldShell>
      </div>
    </div>
  );
}

function PreferencesPanel({ s, on }: { s: Record<string, unknown>; on: (k: string, v: unknown) => void }) {
  const str = (k: string) => String(s[k] ?? '');
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
      <FieldShell label="Language">
        <Sel value={str('pref_language')} onChange={(v) => on('pref_language', v)} options={['English', 'Spanish', 'French', 'German', 'Portuguese', 'Japanese']} />
      </FieldShell>
      <FieldShell label="Date Format">
        <Sel value={str('pref_date_format')} onChange={(v) => on('pref_date_format', v)} options={['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']} />
      </FieldShell>
      <FieldShell label="Timezone">
        <Sel value={str('pref_timezone')} onChange={(v) => on('pref_timezone', v)} options={['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo']} />
      </FieldShell>
      <FieldShell label="Currency Display">
        <Sel value={str('pref_currency_display')} onChange={(v) => on('pref_currency_display', v)} options={['Symbol ($)', 'Code (USD)']} />
      </FieldShell>
      <FieldShell label="Fiscal Year Start">
        <Sel value={str('pref_fiscal_year_start')} onChange={(v) => on('pref_fiscal_year_start', v)} options={['January', 'April', 'July', 'October']} />
      </FieldShell>
    </div>
  );
}

function SfdcPanel({ s, on }: { s: Record<string, unknown>; on: (k: string, v: unknown) => void }) {
  const str = (k: string) => String(s[k] ?? '');
  const bool = (k: string) => Boolean(s[k]);
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
      <FieldShell label="SFDC Account ID">
        <input value={str('sfdc_account_id')} onChange={(e) => on('sfdc_account_id', e.target.value)} className={inputClass} placeholder="001…" />
      </FieldShell>
      <FieldShell label="SFDC Opportunity ID">
        <input value={str('sfdc_opportunity_id')} onChange={(e) => on('sfdc_opportunity_id', e.target.value)} className={inputClass} placeholder="006…" />
      </FieldShell>
      <FieldShell label="SFDC Owner">
        <input value={str('sfdc_owner')} onChange={(e) => on('sfdc_owner', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="SFDC Last Sync">
        <input type="date" value={str('sfdc_last_sync')} onChange={(e) => on('sfdc_last_sync', e.target.value)} className={inputClass} />
      </FieldShell>
      <FieldShell label="SFDC Record Type">
        <Sel value={str('sfdc_record_type')} onChange={(v) => on('sfdc_record_type', v)} options={['Standard', 'Partner', 'Channel']} />
      </FieldShell>
      <Check id="sfdc_sync_enabled" checked={bool('sfdc_sync_enabled')} onChange={(v) => on('sfdc_sync_enabled', v)} label="SFDC Sync Enabled" />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CustomerFormSections({ core, custom, statusNode }: Props) {
  const [activeTab, setActiveTab] = useState('sales');
  const s = core.fields;
  const on = core.onChange;
  const str = (k: string) => String(s[k] ?? '');
  const bool = (k: string) => Boolean(s[k]);

  return (
    <>
      {/* ── Primary Information ──────────────────────────────────────── */}
      <Section title="Primary Information">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
          <FieldShell label="Company Name" required>
            <input required value={str('company_name')} onChange={(e) => on('company_name', e.target.value)} className={inputClass} placeholder="Acme Corp" />
          </FieldShell>
          <FieldShell label="Status" required>
            {statusNode}
          </FieldShell>
          <FieldShell label="Comments">
            <textarea rows={3} value={str('comments')} onChange={(e) => on('comments', e.target.value)} className={`${inputClass} resize-none`} />
          </FieldShell>
          <FieldShell label="Parent Company">
            <input value={str('parent_company')} onChange={(e) => on('parent_company', e.target.value)} className={inputClass} />
          </FieldShell>
          <FieldShell label="SFDC Customer Status">
            <Sel value={str('sfdc_customer_status')} onChange={(v) => on('sfdc_customer_status', v)} options={['Active', 'Inactive', 'Churned', 'Prospect']} />
          </FieldShell>
          <FieldShell label="Zuora Invoice Name">
            <input value={str('zuora_invoice_name')} onChange={(e) => on('zuora_invoice_name', e.target.value)} className={inputClass} />
          </FieldShell>
          <FieldShell label="Account Status">
            <Sel value={str('account_status')} onChange={(v) => on('account_status', v)} options={['Active', 'Inactive', 'Suspended', 'Pending']} />
          </FieldShell>
          <FieldShell label="Customer Type">
            <Sel value={str('customer_type')} onChange={(v) => on('customer_type', v)} options={['Customer', 'Partner', 'Reseller', 'Prospect']} />
          </FieldShell>
          <FieldShell label="AR Status">
            <Sel value={str('ar_status')} onChange={(v) => on('ar_status', v)} options={['Current', 'Past Due', '30 Days', '60 Days', 'Collections']} />
          </FieldShell>
          <FieldShell label="Billing Account Name">
            <input value={str('billing_account_name')} onChange={(e) => on('billing_account_name', e.target.value)} className={inputClass} />
          </FieldShell>
        </div>
      </Section>

      {/* ── Email | Phone | Address ──────────────────────────────────── */}
      <Section title="Email | Phone | Address">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
          <FieldShell label="Email" required>
            <input required type="email" value={str('email')} onChange={(e) => on('email', e.target.value)} className={inputClass} />
          </FieldShell>
          <FieldShell label="Phone">
            <input type="tel" value={str('phone')} onChange={(e) => on('phone', e.target.value)} className={inputClass} />
          </FieldShell>
          <FieldShell label="Address">
            <textarea rows={3} value={str('address')} onChange={(e) => on('address', e.target.value)} className={`${inputClass} resize-none`} />
          </FieldShell>
          <FieldShell label="Multiple Email Addresses for Invoices">
            <input value={str('multiple_email_for_invoices')} onChange={(e) => on('multiple_email_for_invoices', e.target.value)} className={inputClass} />
          </FieldShell>
          <FieldShell label="Alt. Phone">
            <input type="tel" value={str('alt_phone')} onChange={(e) => on('alt_phone', e.target.value)} className={inputClass} />
          </FieldShell>
        </div>
      </Section>

      {/* ── Classification ───────────────────────────────────────────── */}
      <Section title="Classification">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
          <FieldShell label="Represents Subsidiary">
            <Sel value={str('represents_subsidiary')} onChange={(v) => on('represents_subsidiary', v)} options={['Yes', 'No']} />
          </FieldShell>
          <FieldShell label="Talkdesk Region">
            <input value={str('talkdesk_region')} onChange={(e) => on('talkdesk_region', e.target.value)} className={inputClass} />
          </FieldShell>
          <FieldShell label="Talkdesk ID Platform">
            <input value={str('talkdesk_id_platform')} onChange={(e) => on('talkdesk_id_platform', e.target.value)} className={inputClass} />
          </FieldShell>
          <FieldShell label="Subsidiary" required>
            <Sel required value={str('subsidiary')} onChange={(v) => on('subsidiary', v)} options={['Main', 'US', 'UK', 'EU', 'APAC']} />
          </FieldShell>
          <FieldShell label="Web Address">
            <input type="url" value={str('web_address')} onChange={(e) => on('web_address', e.target.value)} className={inputClass} placeholder="https://" />
          </FieldShell>
          <FieldShell label="CRM CSM">
            <input value={str('crm_csm')} onChange={(e) => on('crm_csm', e.target.value)} className={inputClass} />
          </FieldShell>
          <FieldShell label="CRM CSM Team">
            <input value={str('crm_csm_team')} onChange={(e) => on('crm_csm_team', e.target.value)} className={inputClass} />
          </FieldShell>
          <Check id="white_glove" checked={bool('white_glove')} onChange={(v) => on('white_glove', v)} label="White Glove" />
          <FieldShell label="CRM Growth Manager">
            <input value={str('crm_growth_manager')} onChange={(e) => on('crm_growth_manager', e.target.value)} className={inputClass} />
          </FieldShell>
          <Check id="display_product_code" checked={bool('display_product_code')} onChange={(v) => on('display_product_code', v)} label="Display Product Code" />
          <FieldShell label="AR Analyst">
            <input value={str('ar_analyst')} onChange={(e) => on('ar_analyst', e.target.value)} className={inputClass} />
          </FieldShell>
          <FieldShell label="CRM Account Owner">
            <input value={str('crm_account_owner')} onChange={(e) => on('crm_account_owner', e.target.value)} className={inputClass} />
          </FieldShell>
        </div>
      </Section>

      {/* ── Tabbed section ────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded border border-stone-200 bg-white">
        <TabBar tabs={TABS} active={activeTab} onSelect={setActiveTab} />
        <div className="px-4 py-4">
          {activeTab === 'sales'         && <SalesPanel         s={s} on={on} />}
          {activeTab === 'financial'     && <FinancialPanel     s={s} on={on} />}
          {activeTab === 'subsidiaries'  && <SubsidiariesPanel  s={s} on={on} />}
          {activeTab === 'address'       && <AddressPanel       s={s} on={on} />}
          {activeTab === 'relationships' && <RelationshipsPanel s={s} on={on} />}
          {activeTab === 'communication' && <CommunicationPanel s={s} on={on} />}
          {activeTab === 'zab'           && <ZabPanel           s={s} on={on} />}
          {activeTab === 'zuora_sync'    && <ZuoraSyncPanel     s={s} on={on} />}
          {activeTab === 'zuora_account' && <ZuoraAccountPanel  s={s} on={on} />}
          {activeTab === 'stripe'        && <StripePanel        s={s} on={on} />}
          {activeTab === 'cch'           && <CchPanel           s={s} on={on} />}
          {activeTab === 'edocument'     && <EdocumentPanel     s={s} on={on} />}
          {activeTab === 'custom'        && <CustomPanel        s={s} on={on} />}
          {activeTab === 'preferences'   && <PreferencesPanel   s={s} on={on} />}
          {activeTab === 'sfdc'          && <SfdcPanel          s={s} on={on} />}
        </div>
      </div>

      {/* ── Dynamic custom fields ─────────────────────────────────────── */}
      {custom.defs.length > 0 && (
        <Section title="Custom Fields">
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {custom.defs.map((f) => (
              <DynamicFieldInput
                key={f.id || f.key}
                field={f}
                value={custom.values[f.key]}
                onChange={custom.onChange}
              />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
