import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Sparkles } from 'lucide-react';
import { leadService } from '@/services/leadService';
import type { CreateLeadPayload, LeadType } from '@/types/lead';

const TABS = ['Subsidiaries', 'Qualification', 'Communication', 'Address', 'Marketing', 'Preferences', 'System Information', 'Custom', 'E-Document'] as const;
type Tab = typeof TABS[number];

export default function AddLeadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [leadType, setLeadType] = useState<LeadType>('Company');
  const [activeTab, setActiveTab] = useState<Tab>('Subsidiaries');

  const { mutate: createLead, isPending } = useMutation({
    mutationFn: (payload: CreateLeadPayload) => leadService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      navigate('/crm/lead');
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? '').trim();
    const bool = (key: string) => form.get(key) === 'on';

    createLead({
      customForm: get('customForm') || 'Standard Lead Form',
      leadStatus: (get('leadStatus') as CreateLeadPayload['leadStatus']) || 'LEAD-Unqualified',
      defaultOrderPriority: get('defaultOrderPriority'),
      type: leadType,
      companyName: get('companyName'),
      firstName: get('firstName'),
      lastName: get('lastName'),
      salesRep: get('salesRep'),
      territory: get('territory'),
      partner: get('partner'),
      email: get('email'),
      phone: get('phone'),
      fax: get('fax'),
      address: get('address'),
      primarySubsidiary: get('primarySubsidiary'),
      emailForPaymentNotification: get('emailForPaymentNotification'),
      whiteGlove: bool('whiteGlove'),
      displayProductCode: bool('displayProductCode'),
      blacklineArCashApp: bool('blacklineArCashApp'),
      sfdcAccountId: get('sfdcAccountId'),
      prevExternalId: get('prevExternalId'),
      sfdcCustomerStatus: get('sfdcCustomerStatus'),
      crmAccountOwner: get('crmAccountOwner'),
      customerLegalName: get('customerLegalName'),
      customerType: get('customerType') || 'Customer',
      crmCsmTeam: get('crmCsmTeam'),
      sfdcExternalId: get('sfdcExternalId'),
      additionalEmails: get('additionalEmails'),
      crmCsm: get('crmCsm'),
      talkdeskRegion: get('talkdeskRegion'),
      crmGrowthManager: get('crmGrowthManager'),
      talkdeskIdPlatform: get('talkdeskIdPlatform'),
      zuoraInvoiceName: get('zuoraInvoiceName'),
      estimatedBudget: get('estimatedBudget'),
      budgetApproved: bool('budgetApproved'),
      salesReadiness: get('salesReadiness'),
      buyingReason: get('buyingReason'),
      buyingTimeFrame: get('buyingTimeFrame'),
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-stone-50 min-h-0">
      <form onSubmit={handleSubmit} className="flex flex-col flex-1">

        {/* Page Header Bar */}
        <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => navigate('/crm/lead')}
              disabled={isPending}
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>

          <nav className="hidden sm:flex items-center gap-1 text-xs text-stone-400 font-medium">
            <span>CRM</span>
            <span>/</span>
            <span>Lead</span>
            <span>/</span>
            <span className="text-stone-700 font-semibold">New Lead</span>
          </nav>
        </div>

        {/* Page Title */}
        <div className="bg-white border-b border-stone-100 px-6 py-2 flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-purple-100 flex items-center justify-center">
            <Sparkles className="h-3 w-3 text-purple-600" />
          </div>
          <h1 className="text-sm font-bold text-stone-800">Lead</h1>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {/* Primary Information */}
          <Section title="Primary Information">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div className="space-y-3">
                <Field label="Custom Form">
                  <Select name="customForm" defaultValue="Standard Lead Form">
                    <option>Standard Lead Form</option>
                  </Select>
                </Field>
                <Field label="Lead ID">
                  <div className="flex items-center gap-2">
                    <input
                      name="leadId"
                      readOnly
                      placeholder="To Be Generated"
                      className={`${inputClass} flex-1 bg-stone-50 text-stone-400`}
                    />
                    <label className="flex items-center gap-1 text-[10px] text-stone-500 cursor-pointer">
                      <input type="checkbox" name="autoLeadId" defaultChecked className="rounded" />
                      AUTO
                    </label>
                  </div>
                </Field>
                <Field label="Type" required>
                  <div className="flex items-center gap-4 pt-0.5">
                    {(['Company', 'Individual'] as LeadType[]).map((t) => (
                      <label key={t} className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer">
                        <input
                          type="radio"
                          name="type"
                          value={t}
                          checked={leadType === t}
                          onChange={() => setLeadType(t)}
                          className="accent-blue-600"
                        />
                        {t.toUpperCase()}
                      </label>
                    ))}
                  </div>
                </Field>
                {leadType === 'Company' ? (
                  <Field label="Company Name" required>
                    <input name="companyName" required className={inputClass} />
                  </Field>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First Name" required>
                      <input name="firstName" required className={inputClass} />
                    </Field>
                    <Field label="Last Name">
                      <input name="lastName" className={inputClass} />
                    </Field>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Field label="Lead Status" required>
                  <Select name="leadStatus" defaultValue="LEAD-Unqualified">
                    <option>LEAD-Unqualified</option>
                    <option>LEAD-Qualified</option>
                    <option>LEAD-New</option>
                    <option>LEAD-In Progress</option>
                    <option>LEAD-Converted</option>
                    <option>LEAD-Dead</option>
                  </Select>
                </Field>
                <Field label="Default Order Priority">
                  <input name="defaultOrderPriority" className={inputClass} />
                </Field>
                <Field label="Sales Rep">
                  <Select name="salesRep">
                    <option value="">— Select —</option>
                  </Select>
                </Field>
                <Field label="Territory">
                  <Select name="territory">
                    <option value="">— Select —</option>
                  </Select>
                </Field>
                <Field label="Partner">
                  <Select name="partner">
                    <option value="">— Select —</option>
                  </Select>
                </Field>
              </div>
            </div>
          </Section>

          {/* Email | Phone | Address */}
          <Section title="Email | Phone | Address">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <Field label="Email">
                <input name="email" type="email" className={inputClass} />
              </Field>
              <Field label="Phone">
                <input name="phone" type="tel" className={inputClass} />
              </Field>
              <Field label="Fax">
                <input name="fax" className={inputClass} />
              </Field>
              <Field label="Address">
                <textarea name="address" rows={3} className={`${inputClass} resize-none col-span-2`} />
              </Field>
            </div>
          </Section>

          {/* Classification */}
          <Section title="Classification">
            <div className="grid grid-cols-3 gap-x-6 gap-y-3">
              <Field label="Primary Subsidiary" required>
                <Select name="primarySubsidiary">
                  <option value="">— Select —</option>
                </Select>
              </Field>
              <Field label="Email Address for Payment Notification">
                <input name="emailForPaymentNotification" type="email" className={inputClass} />
              </Field>
              <Field label="SFDC Account ID">
                <input name="sfdcAccountId" className={inputClass} />
              </Field>

              <Field label="SFDC Customer Status">
                <Select name="sfdcCustomerStatus">
                  <option value="">— Select —</option>
                </Select>
              </Field>
              <Field label="CRM Account Owner">
                <input name="crmAccountOwner" className={inputClass} />
              </Field>
              <Field label="Prev External ID">
                <input name="prevExternalId" className={inputClass} />
              </Field>

              <Field label="Customer Type">
                <Select name="customerType" defaultValue="Customer">
                  <option>Customer</option>
                  <option>Prospect</option>
                  <option>Partner</option>
                </Select>
              </Field>
              <Field label="CRM CSM Team">
                <input name="crmCsmTeam" className={inputClass} />
              </Field>
              <Field label="Customer Legal Name">
                <input name="customerLegalName" className={inputClass} />
              </Field>

              <Field label="Additional Emails">
                <input name="additionalEmails" className={inputClass} />
              </Field>
              <Field label="CRM CSM">
                <input name="crmCsm" className={inputClass} />
              </Field>
              <Field label="SFDC External ID">
                <input name="sfdcExternalId" className={inputClass} />
              </Field>

              <Field label="Talkdesk Region">
                <input name="talkdeskRegion" className={inputClass} />
              </Field>
              <Field label="CRM Growth Manager">
                <input name="crmGrowthManager" className={inputClass} />
              </Field>
              <div /> {/* spacer */}

              <Field label="Talkdesk ID Platform">
                <input name="talkdeskIdPlatform" className={inputClass} />
              </Field>
              <Field label="Zuora Invoice Name">
                <input name="zuoraInvoiceName" className={inputClass} />
              </Field>
              <div /> {/* spacer */}

              {/* Checkboxes */}
              <div className="col-span-3 flex items-center gap-6 pt-1">
                <CheckboxField name="whiteGlove" label="White Glove" />
                <CheckboxField name="displayProductCode" label="Display Product Code" />
                <CheckboxField name="blacklineArCashApp" label="Blackline AR Cash App Preferred Interco Represents Entity" />
              </div>
            </div>
          </Section>

          {/* Tabbed Sections */}
          <div className="rounded border border-stone-200 bg-white overflow-hidden">
            {/* Tab Bar */}
            <div className="flex overflow-x-auto border-b border-stone-200 bg-stone-50">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-[11px] font-semibold whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600 bg-white'
                      : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="px-4 py-4">
              {activeTab === 'Qualification' && (
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <Field label="Estimated Budget">
                    <input name="estimatedBudget" className={inputClass} placeholder="e.g. 50000" />
                  </Field>
                  <Field label="Buying Reason">
                    <Select name="buyingReason">
                      <option value="">— Select —</option>
                      <option>Cost Savings</option>
                      <option>Efficiency</option>
                      <option>Compliance</option>
                      <option>Growth</option>
                    </Select>
                  </Field>
                  <div className="flex items-center gap-2 pt-1">
                    <input type="checkbox" name="budgetApproved" id="budgetApproved" className="rounded accent-blue-600" />
                    <label htmlFor="budgetApproved" className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 cursor-pointer">
                      Budget Approved
                    </label>
                  </div>
                  <Field label="Buying Time Frame">
                    <Select name="buyingTimeFrame">
                      <option value="">— Select —</option>
                      <option>0–3 months</option>
                      <option>3–6 months</option>
                      <option>6–12 months</option>
                      <option>12+ months</option>
                    </Select>
                  </Field>
                  <Field label="Sales Readiness">
                    <Select name="salesReadiness">
                      <option value="">— Select —</option>
                      <option>Early Stage</option>
                      <option>Mid Stage</option>
                      <option>Late Stage</option>
                      <option>Ready to Buy</option>
                    </Select>
                  </Field>
                </div>
              )}

              {activeTab === 'Subsidiaries' && (
                <p className="text-xs text-stone-400 py-4 text-center">No subsidiary data yet.</p>
              )}

              {activeTab !== 'Qualification' && activeTab !== 'Subsidiaries' && (
                <p className="text-xs text-stone-400 py-4 text-center">
                  {activeTab} information will be available after the lead is created.
                </p>
              )}
            </div>
          </div>

        </div>
      </form>
    </div>
  );
}

const inputClass =
  'w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800 outline-none placeholder:text-stone-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 border-b border-stone-200 bg-blue-50 px-4 py-2">
        <ChevronDown className="size-3 text-stone-400" />
        <h3 className="text-[11px] font-bold text-stone-700 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-500">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className={`${inputClass} appearance-none cursor-pointer`}
    >
      {children}
    </select>
  );
}

function CheckboxField({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500 cursor-pointer">
      <input type="checkbox" name={name} className="rounded accent-blue-600" />
      {label}
    </label>
  );
}
