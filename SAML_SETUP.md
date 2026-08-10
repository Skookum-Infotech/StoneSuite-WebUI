# SAML / SSO Setup — Where Things Stand

This explains what's built for SAML/SSO configuration in StoneSuite-WebUI today,
so the next dev picking this up doesn't have to reverse-engineer it.

**tl;dr: you can save SSO provider connection details, but nobody can actually
sign in with SSO yet.** There's no login flow — this is configuration storage only.

## The one thing to understand first

There are **two separate pieces of UI** that both talk about "SAML setup" but
aren't connected to each other yet:

| | Configured providers | Setup guides |
|---|---|---|
| **What it is** | A real CRUD form that saves SSO connection details | A step-by-step walkthrough + a form that saves nothing |
| **Backed by a real API?** | Yes — `/api/tenant/sso-configs` | No — the "Connect StoneSuite" form is local component state, `disabled` Save button |
| **Providers** | Entra, Cognito, Okta | Entra, Cognito only (no Okta guide page) |
| **Fields** | `clientId` / `clientSecret` / `issuer` / `redirectUri` / `enabled` (generic OAuth/OIDC shape) | `metadataUrl` / entity ID / ACS URL (SAML-federation shape) |
| **Where** | [`ConfiguredProvidersTab.tsx`](src/pages/config/saml-setup/components/ConfiguredProvidersTab.tsx) | [`EntraSamlSetupPage.tsx`](src/pages/config/saml-setup/EntraSamlSetupPage.tsx), [`CognitoSamlSetupPage.tsx`](src/pages/config/saml-setup/CognitoSamlSetupPage.tsx) |

In other words: saving a config in "Configured providers" does **not** make the
"Setup guides" walkthrough work, and filling out the "Connect StoneSuite" form
in a walkthrough does **not** save anything. Whoever unifies these two is the
next real chunk of work here — see [Open work](#open-work) below.

## Page map

All routes live under `/config/saml-setup`, gated by the `sso_config`
permission (`read` to view, `configure` to add/edit/delete):

```
/config/saml-setup                → SamlSetupPage (tab shell)
  ?tab=configured (default)       →   ConfiguredProvidersTab
  ?tab=guides                     →   SetupGuidesTab (2 provider cards)
/config/saml-setup/entra          → EntraSamlSetupPage (walkthrough)
/config/saml-setup/cognito        → CognitoSamlSetupPage (walkthrough)
```

Sidebar entry: "SAML Setup", `src/config/sidebarNav.ts`.

## 1. Configured providers (the real part)

This is a standard config CRUD screen, same shape as every other `*Service.ts`
feature in the app:

- **Type**: `SSOConfig` in [`types/tenant.ts`](src/types/tenant.ts) — `id`, `tenantId`, `provider` (`'entra' | 'cognito' | 'okta'`), `clientId`, `issuer`, `redirectUri`, `enabled`. `clientSecret` is write-only (accepted on create/update, never returned by the API).
- **Service**: [`ssoConfigService.ts`](src/services/ssoConfigService.ts) — `list` / `create` / `update` / `remove` against `/tenant/sso-configs`. Handles the snake_case→camelCase mapping itself since this is the one tenant-plane endpoint that doesn't already return camelCase.
- **Form + validation**: [`lib/ssoConfigForm.ts`](src/lib/ssoConfigForm.ts) — Zod schema (`ssoConfigSchema`), used by [`SsoConfigModal.tsx`](src/pages/config/saml-setup/components/SsoConfigModal.tsx). Client secret is required on create, optional on edit (blank = keep the existing one — the backend never echoes it back).
- **List UI**: [`ConfiguredProvidersTab.tsx`](src/pages/config/saml-setup/components/ConfiguredProvidersTab.tsx) — table of saved configs, add/edit/delete, gated by `hasPermission('sso_config', 'configure')`.
- One config per provider max — the "Add provider" button only offers providers that don't already have a saved config (`availableProviders` filter).
- **Gotcha**: the backend fails closed with `503` if it has no encryption key configured for secrets. `ssoConfigErrorMessage()` turns that into a readable "contact your administrator" message instead of a raw API error.

## 2. Setup guides (the preview part)

Per-provider walkthrough pages that show an admin how to configure **their**
identity provider (Entra or Cognito) to federate with StoneSuite — copyable
Entity ID / ACS URL values, attribute-mapping tables, numbered steps
([`SetupStep.tsx`](src/pages/config/saml-setup/components/SetupStep.tsx), [`CopyField.tsx`](src/pages/config/saml-setup/components/CopyField.tsx), [`AttributeMappingTable.tsx`](src/pages/config/saml-setup/components/AttributeMappingTable.tsx)).

Both pages carry an in-app amber warning banner saying this is a preview and
hasn't been verified against a live tenant. Concretely, that means:

- The SP Entity ID / ACS URL values (`https://app.stonesuite.io/saml/entra/metadata`, etc. — top of each page file) are **placeholders**, not real StoneSuite endpoints. Nothing on the backend serves SAML metadata or an ACS endpoint yet.
- The "Connect StoneSuite" form at the bottom ([`SamlConnectForm.tsx`](src/pages/config/saml-setup/components/SamlConnectForm.tsx)) is local `useState`, no `service` call. The Save button is `disabled` with a "Coming soon" badge — this is intentionally non-functional.

## Open work

If you're extending this, the gaps in rough priority order:

1. **No SAML login flow exists anywhere** (SP-initiated redirect, ACS assertion consumption, JWT issuance). `ssoConfigService.ts` says so directly in its top comment. Everything today is configuration storage.
2. **The two config surfaces aren't unified.** Either the walkthrough's "Connect StoneSuite" form should write into the same `sso-configs` API (extending `SSOConfig` with SAML-specific fields like `metadataUrl`), or the two features need a clearer separation in the UI so they don't look like the same thing.
3. **No Okta walkthrough page**, even though Okta is a valid provider in "Configured providers". Either add one (`OktaSamlSetupPage.tsx` + a third `ProviderCard` in `SetupGuidesTab`) or drop Okta from `SSO_PROVIDERS` until it has one.
4. **Placeholder SP values need to become real** once the backend has actual metadata/ACS endpoints to point at.
