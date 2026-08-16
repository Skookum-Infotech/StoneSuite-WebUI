import { AxiosError } from 'axios';
import { z } from 'zod';
import type { SAMLProvider, SSOProvider } from '@/types/tenant';

export const SSO_PROVIDERS: SSOProvider[] = ['entra', 'cognito', 'okta'];

// entra/cognito are the SAML providers with a first-class, vendor-specific
// setup page (see EntraSamlSetupPage/CognitoSamlSetupPage). Any other slug
// matching samlProviderSlugPattern is also accepted by the backend
// (controllers/sso.go's isValidSAMLProvider) and gets the generic
// CustomSamlSetupPage instead.
export const SAML_PROVIDERS: SAMLProvider[] = ['entra', 'cognito'];

// Mirrors the backend's samlProviderSlugPattern (controllers/sso.go): a
// custom SAML provider slug is a URL path segment
// (/api/auth/saml/{provider}/acs) and an SP entity id suffix, so it's kept
// conservative -- lowercase letters/digits/hyphens, 2-30 chars, starting
// with a letter.
export const SAML_PROVIDER_SLUG_PATTERN = /^[a-z][a-z0-9-]{1,29}$/;

export function isValidSamlProvider(provider: string): boolean {
  return (SAML_PROVIDERS as string[]).includes(provider) || SAML_PROVIDER_SLUG_PATTERN.test(provider);
}

export const SSO_PROVIDER_LABELS: Record<SSOProvider, string> = {
  entra: 'Microsoft Entra ID',
  cognito: 'Amazon Cognito',
  okta: 'Okta',
};

// Display label for any SAML provider slug, including a custom one with no
// bespoke setup page (see CustomSamlSetupPage, which derives its own heading
// the same way -- capitalize the slug).
export function samlProviderLabel(provider: SAMLProvider): string {
  if ((SSO_PROVIDERS as string[]).includes(provider)) {
    return SSO_PROVIDER_LABELS[provider as SSOProvider];
  }
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

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

// metadata_url must be https:// and a well-formed URL (mirrors the
// backend's validateSSORequest: strings.HasPrefix(metadataURL, "https://")).
export function samlConfigSchema() {
  return z.object({
    provider: z
      .string()
      .refine(
        isValidSamlProvider,
        'Provider must be entra, cognito, or a custom slug (lowercase letters, digits, hyphens, 2-30 chars, starting with a letter).',
      ),
    metadataUrl: z
      .string()
      .trim()
      .min(1, 'Metadata URL is required')
      .refine((v) => v.startsWith('https://'), 'Must be an https:// URL')
      .refine(isHttpUrl, 'Must be a valid URL'),
    enabled: z.boolean(),
    // '' means no default role — JIT sign-ins get no role, same as before
    // this existed.
    defaultRoleId: z.string(),
  });
}

export type SAMLConfigFormValues = z.infer<ReturnType<typeof samlConfigSchema>>;

// The backend fails closed with 503 when no encryption key is configured —
// surface that as an admin-actionable message instead of the raw API text.
// 502/409 are specific to protocol=saml creates/updates (metadata fetch
// failure, duplicate provider) but harmless to check unconditionally.
export function ssoConfigErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err instanceof AxiosError && err.response?.status === 503) {
    return 'SSO configuration is unavailable — contact your administrator to enable secret encryption.';
  }
  if (err instanceof AxiosError && err.response?.status === 502) {
    return "Couldn't reach or parse that identity provider's metadata document. Double-check the URL and try again.";
  }
  if (err instanceof AxiosError && err.response?.status === 409) {
    return 'A configuration for this provider already exists.';
  }
  if (err instanceof AxiosError) {
    return err.response?.data?.message ?? err.message ?? fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
