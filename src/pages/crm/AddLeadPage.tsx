import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { leadService } from '@/services/leadService';
import { workflowService } from '@/services/tenantServices';
import { DynamicFieldInput } from '@/components/tenant/DynamicFieldInput';
import { Section, FieldShell, inputClass } from '@/components/prospect/ProspectUI';
import type { CreateLeadPayload, LeadType } from '@/types/lead';
import type { FieldDefinition } from '@/types/tenant';

const TABS = ['Subsidiaries', 'Qualification', 'Communication', 'Address', 'Marketing', 'Preferences', 'System Information', 'Custom', 'E-Document'] as const;
type Tab = typeof TABS[number];

export default function AddLeadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [leadType, setLeadType] = useState<LeadType>('Company');
  const [activeTab, setActiveTab] = useState<Tab>('Subsidiaries');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  // Fetch the Lead workflow's custom field definitions (admin-added fields).
  const { data: allWorkflows = [] } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });
  const leadWorkflow = allWorkflows.find((wf) => wf.key.toLowerCase() === 'lead');
  const { data: leadDef } = useQuery({
    queryKey: ['workflow', leadWorkflow?.id],
    queryFn: () => workflowService.get(leadWorkflow!.id),
    enabled: Boolean(leadWorkflow?.id),
  });
  const customFields: FieldDefinition[] = leadDef?.fields ?? [];

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
      customFields: customFieldValues,
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

        {/* Header Bar */}
        <div className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
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
            <span>CRM</span><span>/</span><span>Lead</span><span>/</span>
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

          <Section title="Primary Information">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div className="space-y-3">
                <FieldShell label="Custom Form">
                  <Select name="customForm" defaultValue="Standard Lead Form">
                    <option>Standard Lead Form</option>
                  </Select>
                </FieldShell>
                <FieldShell label="Type" required>
                  <div className="flex items-center gap-4 pt-0.5">
                    {(['Company', 'Individual'] as LeadType[]).map((t) => (
                      <label key={t} className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer">
                        <input type="radio" name="type" value={t} checked={leadType === t} onChange={() => setLeadType(t)} className="accent-blue-600" />
                        {t.toUpperCase()}
                      </label>
                    ))}
                  </div>
                </FieldShell>
                {leadType === 'Company' ? (
                  <FieldShell label="Company Name" required>
                    <input name="companyName" required className={inputClass} />
                  </FieldShell>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <FieldShell label="First Name" required><input name="firstName" required className={inputClass} /></FieldShell>
                    <FieldShell label="Last Name"><input name="lastName" className={inputClass} /></FieldShell>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <FieldShell label="Lead Status" required>
                  <Select name="leadStatus" defaultValue="LEAD-Unqualified">
                    <option>LEAD-Unqualified</option>
                    <option>LEAD-Qualified</option>
                    <option>LEAD-New</option>
                    <option>LEAD-In Progress</option>
                    <option>LEAD-Converted</option>
                    <option>LEAD-Dead</option>
                  </Select>
                </FieldShell>
                <FieldShell label="Default Order Priority"><input name="defaultOrderPriority" className={inputClass} /></FieldShell>
                <FieldShell label="Sales Rep">
                  <Select name="salesRep">
                    <option value="">— Select —</option>
                    <option>Alex Johnson</option>
                    <option>Maria Garcia</option>
                    <option>James Lee</option>
                    <option>Sarah Chen</option>
                    <option>David Kim</option>
                  </Select>
                </FieldShell>
                <FieldShell label="Territory">
                  <Select name="territory">
                    <option value="">— Select —</option>
                    <option>North America – East</option>
                    <option>North America – West</option>
                    <option>EMEA</option>
                    <option>APAC</option>
                    <option>LATAM</option>
                    <option>Global</option>
                  </Select>
                </FieldShell>
                <FieldShell label="Partner">
                  <Select name="partner">
                    <option value="">— Select —</option>
                    <option>Accenture</option>
                    <option>Deloitte Digital</option>
                    <option>KPMG</option>
                    <option>PwC</option>
                    <option>Salesforce Partner Network</option>
                    <option>None</option>
                  </Select>
                </FieldShell>
              </div>
            </div>
          </Section>

          <Section title="Email | Phone | Address">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <FieldShell label="Email"><input name="email" type="email" className={inputClass} /></FieldShell>
              <FieldShell label="Phone"><input name="phone" type="tel" className={inputClass} /></FieldShell>
              <FieldShell label="Fax"><input name="fax" className={inputClass} /></FieldShell>
              <FieldShell label="Address">
                <textarea name="address" rows={3} className={`${inputClass} resize-none col-span-2`} />
              </FieldShell>
            </div>
          </Section>

          <Section title="Classification">
            <div className="grid grid-cols-3 gap-x-6 gap-y-3">
              <FieldShell label="Primary Subsidiary" required>
                <Select name="primarySubsidiary">
                  <option value="">— Select —</option>
                  <option>Talkdesk Inc.</option>
                  <option>Talkdesk UK Ltd.</option>
                  <option>Talkdesk Portugal</option>
                  <option>Talkdesk Germany GmbH</option>
                  <option>Talkdesk Australia Pty Ltd.</option>
                </Select>
              </FieldShell>
              <FieldShell label="Email for Payment Notification">
                <input name="emailForPaymentNotification" type="email" className={inputClass} />
              </FieldShell>
              <FieldShell label="SFDC Account ID"><input name="sfdcAccountId" className={inputClass} /></FieldShell>
              <FieldShell label="SFDC Customer Status">
                <Select name="sfdcCustomerStatus">
                  <option value="">— Select —</option>
                  <option>Active</option>
                  <option>Inactive</option>
                  <option>On Hold</option>
                  <option>Churned</option>
                  <option>Prospect</option>
                  <option>Trial</option>
                </Select>
              </FieldShell>
              <FieldShell label="CRM Account Owner"><input name="crmAccountOwner" className={inputClass} /></FieldShell>
              <FieldShell label="Prev External ID"><input name="prevExternalId" className={inputClass} /></FieldShell>
              <FieldShell label="Customer Type">
                <Select name="customerType" defaultValue="Customer">
                  <option>Customer</option><option>Prospect</option><option>Partner</option>
                </Select>
              </FieldShell>
              <FieldShell label="CRM CSM Team"><input name="crmCsmTeam" className={inputClass} /></FieldShell>
              <FieldShell label="Customer Legal Name"><input name="customerLegalName" className={inputClass} /></FieldShell>
              <FieldShell label="Additional Emails"><input name="additionalEmails" className={inputClass} /></FieldShell>
              <FieldShell label="CRM CSM"><input name="crmCsm" className={inputClass} /></FieldShell>
              <FieldShell label="SFDC External ID"><input name="sfdcExternalId" className={inputClass} /></FieldShell>
              <FieldShell label="Talkdesk Region"><input name="talkdeskRegion" className={inputClass} /></FieldShell>
              <FieldShell label="CRM Growth Manager"><input name="crmGrowthManager" className={inputClass} /></FieldShell>
              <div />
              <FieldShell label="Talkdesk ID Platform"><input name="talkdeskIdPlatform" className={inputClass} /></FieldShell>
              <FieldShell label="Zuora Invoice Name"><input name="zuoraInvoiceName" className={inputClass} /></FieldShell>
              <div />
              <div className="col-span-3 flex items-center gap-6 pt-1">
                <CheckboxField name="whiteGlove" label="White Glove" />
                <CheckboxField name="displayProductCode" label="Display Product Code" />
                <CheckboxField name="blacklineArCashApp" label="Blackline AR Cash App" />
              </div>
            </div>
          </Section>

          {/* Tabbed Sections */}
          <div className="rounded border border-stone-200 bg-white overflow-hidden">
            <div className="flex overflow-x-auto border-b border-stone-200 bg-stone-50">
              {TABS.map((tab) => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-label font-semibold whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? 'border-brand text-stone-800 bg-white' : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-100'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="px-4 py-4">
              {activeTab === 'Qualification' && (
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <FieldShell label="Estimated Budget"><input name="estimatedBudget" className={inputClass} placeholder="e.g. 50000" /></FieldShell>
                  <FieldShell label="Buying Reason">
                    <Select name="buyingReason">
                      <option value="">— Select —</option>
                      <option>Cost Savings</option><option>Efficiency</option><option>Compliance</option><option>Growth</option>
                    </Select>
                  </FieldShell>
                  <div className="flex items-center gap-2 pt-1">
                    <input type="checkbox" name="budgetApproved" id="budgetApproved" className="rounded accent-brand" />
                    <label htmlFor="budgetApproved" className="text-2xs font-semibold uppercase tracking-wide text-stone-500 cursor-pointer">Budget Approved</label>
                  </div>
                  <FieldShell label="Buying Time Frame">
                    <Select name="buyingTimeFrame">
                      <option value="">— Select —</option>
                      <option>0–3 months</option><option>3–6 months</option><option>6–12 months</option><option>12+ months</option>
                    </Select>
                  </FieldShell>
                  <FieldShell label="Sales Readiness">
                    <Select name="salesReadiness">
                      <option value="">— Select —</option>
                      <option>Early Stage</option><option>Mid Stage</option><option>Late Stage</option><option>Ready to Buy</option>
                    </Select>
                  </FieldShell>
                </div>
              )}
              {activeTab !== 'Qualification' && (
                <p className="text-xs text-stone-400 py-4 text-center">
                  {activeTab} information will be available after the lead is created.
                </p>
              )}
            </div>
          </div>

          {/* Dynamic custom fields added by admin in Config */}
          {customFields.length > 0 && (
            <Section title="Custom Fields">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {customFields.map((f) => (
                  <DynamicFieldInput
                    key={f.id || f.key}
                    field={f}
                    value={customFieldValues[f.key]}
                    onChange={(key, value) => setCustomFieldValues((prev) => ({ ...prev, [key]: value }))}
                  />
                ))}
              </div>
            </Section>
          )}
        </div>
      </form>
    </div>
  );
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select {...props} className={`${inputClass} appearance-none cursor-pointer`}>{children}</select>
  );
}

function CheckboxField({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 cursor-pointer">
      <input type="checkbox" name={name} className="rounded accent-brand" /> {label}
    </label>
  );
}
