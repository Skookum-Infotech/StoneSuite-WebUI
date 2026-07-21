import { AxiosError } from 'axios';
import { z } from 'zod';
import type { SSOProvider } from '@/types/tenant';

export const SSO_PROVIDERS: SSOProvider[] = ['entra', 'cognito', 'okta'];

export const SSO_PROVIDER_LABELS: Record<SSOProvider, string> = {
  entra: 'Microsoft Entra ID',
  cognito: 'Amazon Cognito',
  okta: 'Okta',
};

// Mirrors the backend's isHTTPURL (controllers/sso.go): absolute http(s) URL
// with a host. Empty string is valid here — required-ness is handled by the
// caller (issuer/redirectUri are optional fields).
export function isHttpUrl(value: string): boolean {
  if (value === '') return true;
  try {
    const u = new URL(value);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.host !== '';
  } catch {
    return false;
  }
}

const urlField = z
  .string()
  .trim()
  .refine(isHttpUrl, 'Must be a valid http(s) URL');

// requireSecret is true on create (backend requires client_secret); false on
// edit, where a blank value means "keep the existing secret".
export function ssoConfigSchema(requireSecret: boolean) {
  return z.object({
    provider: z.enum(['entra', 'cognito', 'okta']),
    clientId: z.string().trim().min(1, 'Client ID is required'),
    clientSecret: requireSecret
      ? z.string().trim().min(1, 'Client secret is required')
      : z.string().trim().optional(),
    issuer: urlField.optional(),
    redirectUri: urlField.optional(),
    enabled: z.boolean(),
  });
}

export type SSOConfigFormValues = z.infer<ReturnType<typeof ssoConfigSchema>>;

// The backend fails closed with 503 when no encryption key is configured —
// surface that as an admin-actionable message instead of the raw API text.
export function ssoConfigErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err instanceof AxiosError && err.response?.status === 503) {
    return 'SSO configuration is unavailable — contact your administrator to enable secret encryption.';
  }
  if (err instanceof AxiosError) {
    return err.response?.data?.message ?? err.message ?? fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
