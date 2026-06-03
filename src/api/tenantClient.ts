// Thin wrapper around the shared axios client so the multi-tenant feature
// modules (workflows, roles, platform onboarding) can share one HTTP client
// and a consistent error-message helper. Auth uses the same `auth-token` the
// rest of the app uses (now minted by /api/auth/tenant-login).
import { AxiosError } from 'axios';
import { apiClient } from '@/api/client';

export const TENANT_TOKEN_KEY = 'auth-token';

export const tenantClient = apiClient;

/** Best-effort extraction of a human-readable message from an API error. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err instanceof AxiosError) {
    return err.response?.data?.message ?? err.message ?? fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
