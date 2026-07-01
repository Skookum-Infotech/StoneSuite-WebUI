-- =====================================================================
-- Tenant-template schema (applied to EACH tenant's isolated database).
-- Phase 0 baseline: tenant-local user profiles. Roles/RBAC (Phase 2)
-- and the workflow engine (Phase 3) are added as later tenant migrations.
--
-- NOTE: identity_id references a row in the CONTROL-PLANE database, which
-- is a different database. Cross-database foreign keys are impossible in
-- Postgres, so identity_id is stored as a plain UUID with no FK constraint.
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id  UUID NOT NULL,              -- control-plane identities.id (no cross-DB FK)
    email        VARCHAR(255) NOT NULL,      -- denormalized for convenience/display
    full_name    VARCHAR(255) NOT NULL DEFAULT '',
    status       VARCHAR(32)  NOT NULL DEFAULT 'active', -- active | invited | disabled
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_identity ON users(identity_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email    ON users(LOWER(email));

-- =====================================================================
-- Tenant-template schema — Phase 2: dynamic RBAC.
-- Applied to EACH tenant's isolated database after the base schema.
--
-- Model: roles are bundles of {resource, action, scope} permissions.
-- The permission CATALOG (which resources/actions exist) lives in Go;
-- these tables store which roles grant what, and who has which roles.
--
-- The seeded `super_admin` system role is granted a single wildcard
-- permission ('*','*','all') which the Go enforcer treats as match-all,
-- so it does not need a row per catalog entry.
-- =====================================================================

CREATE TABLE IF NOT EXISTS roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key         VARCHAR(64)  NOT NULL,                 -- stable machine key, e.g. super_admin
    name        VARCHAR(128) NOT NULL,                 -- human label
    description TEXT         NOT NULL DEFAULT '',
    is_system   BOOLEAN      NOT NULL DEFAULT FALSE,   -- system roles cannot be deleted/renamed-key
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_key ON roles(LOWER(key));

CREATE TABLE IF NOT EXISTS role_permissions (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id   UUID        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    resource  VARCHAR(64) NOT NULL,                    -- catalog resource, or '*' (wildcard)
    action    VARCHAR(32) NOT NULL,                    -- catalog action, or '*' (wildcard)
    scope     VARCHAR(16) NOT NULL DEFAULT 'all',      -- all | team | own
    CONSTRAINT role_permissions_scope_chk CHECK (scope IN ('all', 'team', 'own')),
    CONSTRAINT role_permissions_unique UNIQUE (role_id, resource, action)
);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);

-- Teams give meaning to the 'team' permission scope (used by record visibility
-- in the Phase 3 workflow engine). Defined now so scope='team' is enforceable.
CREATE TABLE IF NOT EXISTS teams (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (team_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- =====================================================================
-- Tenant-template schema — Phase 3: dynamic workflow engine.
-- Applied to EACH tenant's isolated database after RBAC.
--
-- Workflows are state machines defined as DATA (these tables), edited by a
-- super admin in the UI. Lead/Prospect/Customer ship as seeded default
-- workflows (rows), not hardcoded tables. Each workflow has built-in
-- (core_fields) plus up to 15 admin-defined custom keys (custom_fields),
-- governed by workflow_field_definitions and validated in Go.
-- =====================================================================

CREATE TABLE IF NOT EXISTS workflows (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    key         VARCHAR(64)  NOT NULL,                 -- lead | prospect | customer | ...
    name        VARCHAR(128) NOT NULL,
    description TEXT         NOT NULL DEFAULT '',
    enabled     BOOLEAN      NOT NULL DEFAULT TRUE,    -- super admin can disable
    is_default  BOOLEAN      NOT NULL DEFAULT FALSE,   -- seeded default workflow
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflows_key ON workflows(LOWER(key));

CREATE TABLE IF NOT EXISTS workflow_states (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID         NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    key         VARCHAR(64)  NOT NULL,
    name        VARCHAR(128) NOT NULL,
    is_initial  BOOLEAN      NOT NULL DEFAULT FALSE,
    is_terminal BOOLEAN      NOT NULL DEFAULT FALSE,
    sort_order  INT          NOT NULL DEFAULT 0,
    color       VARCHAR(16)  NOT NULL DEFAULT '',
    CONSTRAINT workflow_states_unique UNIQUE (workflow_id, key)
);
CREATE INDEX IF NOT EXISTS idx_workflow_states_workflow ON workflow_states(workflow_id);

CREATE TABLE IF NOT EXISTS workflow_transitions (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id         UUID         NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    from_state_id       UUID         NOT NULL REFERENCES workflow_states(id) ON DELETE CASCADE,
    to_state_id         UUID         NOT NULL REFERENCES workflow_states(id) ON DELETE CASCADE,
    name                VARCHAR(128) NOT NULL,
    required_permission VARCHAR(128) NOT NULL DEFAULT '', -- "resource:action" (optional refinement)
    guard               JSONB        NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"requiredFields":["email"]}
    sort_order          INT          NOT NULL DEFAULT 0,
    CONSTRAINT workflow_transitions_unique UNIQUE (workflow_id, from_state_id, to_state_id)
);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_workflow ON workflow_transitions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_from ON workflow_transitions(from_state_id);

-- Actions fired on transition. Execution is the Phase 4 concern; the schema is
-- defined now so transitions can carry their action config.
CREATE TABLE IF NOT EXISTS workflow_transition_actions (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    transition_id UUID        NOT NULL REFERENCES workflow_transitions(id) ON DELETE CASCADE,
    type          VARCHAR(32) NOT NULL, -- send_email|assign_owner|set_field|webhook|create_record
    config        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    sort_order    INT         NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_wf_transition_actions_transition ON workflow_transition_actions(transition_id);

CREATE TABLE IF NOT EXISTS workflow_field_definitions (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID         NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    key         VARCHAR(64)  NOT NULL,
    label       VARCHAR(128) NOT NULL,
    data_type   VARCHAR(16)  NOT NULL, -- string|number|date|bool|enum|email
    required    BOOLEAN      NOT NULL DEFAULT FALSE,
    options     JSONB        NOT NULL DEFAULT '[]'::jsonb, -- enum options
    validation  JSONB        NOT NULL DEFAULT '{}'::jsonb, -- {regex, min, max}
    sort_order  INT          NOT NULL DEFAULT 0,
    CONSTRAINT wf_field_type_chk CHECK (data_type IN ('string','number','date','bool','enum','email')),
    CONSTRAINT wf_field_unique UNIQUE (workflow_id, key)
);
CREATE INDEX IF NOT EXISTS idx_wf_field_defs_workflow ON workflow_field_definitions(workflow_id);

CREATE TABLE IF NOT EXISTS workflow_records (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id      UUID        NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    current_state_id UUID        REFERENCES workflow_states(id),
    owner_user_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
    team_id          UUID        REFERENCES teams(id) ON DELETE SET NULL,
    core_fields      JSONB       NOT NULL DEFAULT '{}'::jsonb, -- workflow built-ins
    custom_fields    JSONB       NOT NULL DEFAULT '{}'::jsonb, -- the <=15 dynamic keys
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflow_records_workflow ON workflow_records(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_records_state   ON workflow_records(current_state_id);
CREATE INDEX IF NOT EXISTS idx_workflow_records_owner   ON workflow_records(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_records_team    ON workflow_records(team_id);
-- GIN index keeps custom_fields filtering (custom_fields->>'key') fast.
CREATE INDEX IF NOT EXISTS idx_workflow_records_custom_gin ON workflow_records USING GIN (custom_fields);

CREATE TABLE IF NOT EXISTS workflow_record_history (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id     UUID        NOT NULL REFERENCES workflow_records(id) ON DELETE CASCADE,
    from_state_id UUID,
    to_state_id   UUID,
    actor_user_id UUID,
    transition_id UUID,
    at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    snapshot      JSONB       NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_wf_record_history_record ON workflow_record_history(record_id);

-- =====================================================================
-- Tenant-template schema — Phase 4: dedicated Prospects table.
-- Provides a first-class CRM prospects entity with typed, indexed columns
-- instead of storing everything in the generic workflow_records JSONB blob.
-- =====================================================================

CREATE TABLE IF NOT EXISTS prospects (
    id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id            UUID         REFERENCES users(id) ON DELETE SET NULL,
    custom_form              VARCHAR(128) NOT NULL DEFAULT '',
    status                   VARCHAR(128) NOT NULL DEFAULT 'PROSPECT-In Discussion',
    comments                 TEXT         NOT NULL DEFAULT '',
    customer_id              VARCHAR(64)  NOT NULL DEFAULT '',
    customer_id_auto         BOOLEAN      NOT NULL DEFAULT TRUE,
    parent_company           VARCHAR(255) NOT NULL DEFAULT '',
    sfdc_customer_status     VARCHAR(64)  NOT NULL DEFAULT '',
    company_name             VARCHAR(255) NOT NULL,
    zuora_invoice_name       VARCHAR(255) NOT NULL DEFAULT '',
    account_status           VARCHAR(64)  NOT NULL DEFAULT '',
    customer_type            VARCHAR(64)  NOT NULL DEFAULT 'Customer',
    ar_status                VARCHAR(64)  NOT NULL DEFAULT '',
    billing_account_name     VARCHAR(255) NOT NULL DEFAULT '',
    email                    VARCHAR(255) NOT NULL DEFAULT '',
    phone                    VARCHAR(64)  NOT NULL DEFAULT '',
    address                  TEXT         NOT NULL DEFAULT '',
    multiple_email_invoices  TEXT         NOT NULL DEFAULT '',
    alt_phone                VARCHAR(64)  NOT NULL DEFAULT '',
    subsidiary               VARCHAR(128) NOT NULL DEFAULT '',
    talkdesk_region          VARCHAR(128) NOT NULL DEFAULT '',
    talkdesk_id_platform     VARCHAR(128) NOT NULL DEFAULT '',
    web_address              VARCHAR(512) NOT NULL DEFAULT '',
    crm_account_owner        VARCHAR(255) NOT NULL DEFAULT '',
    ar_analyst               VARCHAR(255) NOT NULL DEFAULT '',
    crm_csm                  VARCHAR(255) NOT NULL DEFAULT '',
    crm_csm_team             VARCHAR(255) NOT NULL DEFAULT '',
    crm_growth_manager       VARCHAR(255) NOT NULL DEFAULT '',
    white_glove              BOOLEAN      NOT NULL DEFAULT FALSE,
    display_product_code     BOOLEAN      NOT NULL DEFAULT FALSE,
    territory                VARCHAR(64)  NOT NULL DEFAULT '',
    estimated_budget         NUMERIC(15,2),
    budget_approved          BOOLEAN      NOT NULL DEFAULT FALSE,
    sales_readiness          VARCHAR(64)  NOT NULL DEFAULT '',
    buying_reason            VARCHAR(64)  NOT NULL DEFAULT '',
    buying_time_frame        VARCHAR(64)  NOT NULL DEFAULT '',
    credit_limit             NUMERIC(15,2),
    payment_terms            VARCHAR(64)  NOT NULL DEFAULT '',
    currency                 VARCHAR(16)  NOT NULL DEFAULT '',
    tax_id                   VARCHAR(128) NOT NULL DEFAULT '',
    primary_subsidiary       VARCHAR(128) NOT NULL DEFAULT '',
    consolidated_balance     NUMERIC(15,2),
    default_billing_address  TEXT         NOT NULL DEFAULT '',
    default_shipping_address TEXT         NOT NULL DEFAULT '',
    sales_rep                VARCHAR(255) NOT NULL DEFAULT '',
    partner                  VARCHAR(255) NOT NULL DEFAULT '',
    primary_contact          VARCHAR(255) NOT NULL DEFAULT '',
    contact_role             VARCHAR(128) NOT NULL DEFAULT '',
    preferred_channel        VARCHAR(64)  NOT NULL DEFAULT '',
    email_preference         VARCHAR(255) NOT NULL DEFAULT '',
    unsubscribe_all          BOOLEAN      NOT NULL DEFAULT FALSE,
    zab_account_id           VARCHAR(128) NOT NULL DEFAULT '',
    subscription_plan        VARCHAR(255) NOT NULL DEFAULT '',
    billing_cycle            VARCHAR(32)  NOT NULL DEFAULT '',
    zuora_account_id         VARCHAR(128) NOT NULL DEFAULT '',
    sync_status              VARCHAR(32)  NOT NULL DEFAULT '',
    last_synced              VARCHAR(64)  NOT NULL DEFAULT '',
    zuora_account_number     VARCHAR(128) NOT NULL DEFAULT '',
    zuora_balance            NUMERIC(15,2),
    zuora_auto_pay           BOOLEAN      NOT NULL DEFAULT FALSE,
    stripe_customer_id       VARCHAR(128) NOT NULL DEFAULT '',
    stripe_payment_method    VARCHAR(128) NOT NULL DEFAULT '',
    stripe_currency          VARCHAR(16)  NOT NULL DEFAULT '',
    suretax_customer_number  VARCHAR(128) NOT NULL DEFAULT '',
    tax_exempt               BOOLEAN      NOT NULL DEFAULT FALSE,
    exemption_certificate    VARCHAR(255) NOT NULL DEFAULT '',
    edoc_enabled             BOOLEAN      NOT NULL DEFAULT FALSE,
    edoc_format              VARCHAR(16)  NOT NULL DEFAULT '',
    edoc_email               VARCHAR(255) NOT NULL DEFAULT '',
    custom_field_1           TEXT         NOT NULL DEFAULT '',
    custom_field_2           TEXT         NOT NULL DEFAULT '',
    custom_notes             TEXT         NOT NULL DEFAULT '',
    language                 VARCHAR(64)  NOT NULL DEFAULT '',
    timezone                 VARCHAR(64)  NOT NULL DEFAULT '',
    date_format              VARCHAR(32)  NOT NULL DEFAULT '',
    receive_newsletter       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospects_company ON prospects(company_name);
CREATE INDEX IF NOT EXISTS idx_prospects_email   ON prospects(email);
CREATE INDEX IF NOT EXISTS idx_prospects_status  ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_owner   ON prospects(owner_user_id);
