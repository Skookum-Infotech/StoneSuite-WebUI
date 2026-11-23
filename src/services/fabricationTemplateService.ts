import { tenantClient } from '@/api/tenantClient';
import type { CommandMeta } from '@/types/fabricationActions';
import type { SubmitTemplateInput, TemplateRevision } from '@/types/fabricationTemplates';
const base = (job: string) => `/tenant/fabrication-jobs/${encodeURIComponent(job)}/templates`;
const portalBase = (job: string, revision: string) => `/portal/fabrication-jobs/${encodeURIComponent(job)}/templates/${encodeURIComponent(revision)}`;
export const fabricationTemplateService = {
  list: (job: string) => tenantClient.get<{ templates: TemplateRevision[] }>(base(job)).then(({ data }) => data.templates),
  submit: (job: string, input: SubmitTemplateInput) => tenantClient.post(base(job), input),
  decide: (job: string, revision: string, input: CommandMeta & { approve: boolean; reason: string }) => tenantClient.post(`${base(job)}/${encodeURIComponent(revision)}/decision`, input),
  recordCustomer: (job: string, revision: string, input: CommandMeta & { approver: string; channel: string; evidence: string; approvedAt: string }) => tenantClient.post(`${base(job)}/${encodeURIComponent(revision)}/customer-approval`, input),
  customerView: (job: string, revision: string) => tenantClient.get<{ template: TemplateRevision }>(portalBase(job, revision)).then(({ data }) => data.template),
  customerApprove: (job: string, revision: string, input: CommandMeta) => tenantClient.post(`${portalBase(job, revision)}/approve`, input),
};
