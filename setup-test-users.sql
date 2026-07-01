-- =====================================================================
-- StoneSuite Initial Test Data Setup
-- =====================================================================
-- This script initializes the stonesuite_cp control-plane database with:
--   - One test tenant
--   - One platform admin user
--   - One normal (non-admin) user
--
-- HOW TO USE:
-- Option 1 (Adminer):
--   1. Open http://localhost:8081
--   2. Login with: stonesuite / stonesuite_secret @ localhost
--   3. Select database: stonesuite_cp
--   4. Go to "SQL command" and paste this entire script
--   5. Click "Execute"
--
-- Option 2 (psql):
--   docker exec -i stonesuite-db psql -U stonesuite -d stonesuite_cp < setup-test-users.sql
--
-- Option 3 (Direct bash):
--   cat setup-test-users.sql | docker exec -i stonesuite-db psql -U stonesuite -d stonesuite_cp
--
-- =====================================================================

-- ── CLEANUP (optional - uncomment if you want to reset) ──────────────
-- DELETE FROM platform_admins WHERE identity_id IN (
--   SELECT id FROM identities WHERE email LIKE '%test%'
-- );
-- DELETE FROM identities WHERE email LIKE '%test%';
-- DELETE FROM tenants WHERE slug = 'test-company';

-- ─────────────────────────────────────────────────────────────────────
-- 1. CREATE TEST TENANT
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO tenants (
  id,
  slug,
  display_name,
  status,
  is_platform_owner,
  db_name,
  migration_status
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'test-company',
  'Test Company',
  'active',
  FALSE,
  'tenant_test_company',
  'ok'
);

-- ─────────────────────────────────────────────────────────────────────
-- 2. CREATE PLATFORM ADMIN USER
-- ─────────────────────────────────────────────────────────────────────
-- Email: admin@test-company.com
-- Password: admin123
-- Platform Admin: YES
-- Hash generated with: bcryptjs at cost 10
INSERT INTO identities (
  id,
  tenant_id,
  email,
  password_hash,
  full_name,
  email_verified
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440000',
  'admin@test-company.com',
  '$2b$10$SmRw4ilX7ZH52Xs6sa.HE.Kr8T37fbc7Vbk11tO5OuXfPJuu1ubbG',
  'Admin User',
  TRUE
);

-- ─────────────────────────────────────────────────────────────────────
-- 3. GRANT PLATFORM ADMIN ROLE
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO platform_admins (identity_id, role)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'platform_admin'
);

-- ─────────────────────────────────────────────────────────────────────
-- 4. CREATE NORMAL (NON-ADMIN) USER
-- ─────────────────────────────────────────────────────────────────────
-- Email: user@test-company.com
-- Password: user123
-- Platform Admin: NO
-- Hash generated with: bcryptjs at cost 10
INSERT INTO identities (
  id,
  tenant_id,
  email,
  password_hash,
  full_name,
  email_verified
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440000',
  'user@test-company.com',
  '$2b$10$d2IXs2N.wGwGeikF7q9YSOiMjqOZw7fAzD25I2OiBIGKozxVHiUZK',
  'Normal User',
  TRUE
);

-- =====================================================================
-- ✅ FINAL CREDENTIALS
-- =====================================================================
-- Tenant: test-company (slug: test-company)
--
-- Admin User:
--   Email:         admin@test-company.com
--   Password:      admin123
--   Full Name:     Admin User
--   Platform Admin: YES ✅
--
-- Normal User:
--   Email:         user@test-company.com
--   Password:      user123
--   Full Name:     Normal User
--   Platform Admin: NO
--
-- =====================================================================
-- LOGIN URL: http://localhost:5173/login
-- ADMINER URL: http://localhost:8081
-- =====================================================================
