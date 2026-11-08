-- =============================================================================
-- OISM.institute — Cloudflare D1 Database Schema & Founding Seed
-- Execute via: npx.cmd wrangler d1 execute oism-db --remote --file=./schema.sql
-- =============================================================================

-- 1. Verified Credentials & Cohort 2027 Beta Registry
CREATE TABLE IF NOT EXISTS credentials (
  serial_id TEXT PRIMARY KEY,              -- e.g., 'OISM-2027-OMEGA-0001'
  recipient_name TEXT NOT NULL,
  prefixes TEXT DEFAULT 'Rev. Dr.',        -- e.g., 'Rev. Dr.'
  post_nominals TEXT DEFAULT 'Ph.D. (h.c.), D.S.M., OMP, CSA, FOI',
  degree_title TEXT NOT NULL,              -- e.g., 'Doctor of Philosophy in Sovereign Mastery (h.c.)'
  cohort TEXT DEFAULT 'October 2027 Founding Beta',
  status TEXT DEFAULT 'VERIFIED IN GOOD STANDING',
  issued_at TEXT NOT NULL,
  sha256_hash TEXT NOT NULL
);

-- 2. Institutional Domain Scarcity Quotas
CREATE TABLE IF NOT EXISTS domain_quotas (
  institution_domain TEXT PRIMARY KEY,     -- e.g., 'acme.com' or 'lincolnhigh.edu'
  institution_type TEXT NOT NULL,          -- 'TITLE1_HS' (90%), 'STD_HS' (50%), 'NONPROFIT' (35%), 'CORP_HR' (5-10%)
  discount_pct INTEGER NOT NULL,
  max_codes INTEGER NOT NULL,              -- 2 for TITLE1_HS, 3 for STD_HS, 2 for NONPROFIT, 5 for CORP_HR
  claimed_codes INTEGER DEFAULT 0
);

-- 3. Voucher Requests & Generated Promo Codes
CREATE TABLE IF NOT EXISTS voucher_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_email TEXT NOT NULL,
  gatekeeper_name TEXT NOT NULL,
  gatekeeper_email TEXT NOT NULL,
  institution_domain TEXT NOT NULL,
  institution_type TEXT NOT NULL,
  discount_pct INTEGER NOT NULL,
  voucher_code TEXT UNIQUE,                -- Generated once gatekeeper confirms Good Standing
  verify_token TEXT UNIQUE,                -- Token used in /verify-voucher?token=...
  status TEXT DEFAULT 'PENDING_GATEKEEPER_VERIFICATION',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 4. October 2028 Waitlist, LP Inquiries & Support Logs
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_type TEXT NOT NULL,           -- 'WAITLIST_2028', 'ENDOWMENT_LP_INQUIRY', 'SUPPORT_TICKET', 'INBOUND_EMAIL'
  email TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Seed Founding Sovereign Chancellor Credential (Tim Shangle)
INSERT OR REPLACE INTO credentials (
  serial_id,
  recipient_name,
  prefixes,
  post_nominals,
  degree_title,
  cohort,
  status,
  issued_at,
  sha256_hash
) VALUES (
  'OISM-2027-OMEGA-0001',
  'Tim Shangle',
  'Rev. Dr.',
  'Ph.D. (h.c.), D.S.M., OMP, CSA, FOI',
  'Doctor of Philosophy in Sovereign Mastery & Neural Compression (h.c.)',
  'October 2027 Founding Beta (Sovereign Chancellor)',
  'VERIFIED IN GOOD STANDING — SOVEREIGN CHANCELLOR',
  '2026-11-08T00:00:00Z',
  'e9f8b3c4d2a1908f7e6d5c4b3a29182736455463728190a1b2c3d4e5f6071829'
);

-- Seed Sample Domain Quotas for Instant Demo Lookups
INSERT OR IGNORE INTO domain_quotas (institution_domain, institution_type, discount_pct, max_codes, claimed_codes) VALUES
  ('spartaschools.org', 'TITLE1_HS', 90, 2, 0),
  ('harvard.edu', 'STD_HS', 50, 3, 2),
  ('alpha.school', 'STD_HS', 50, 3, 1),
  ('acme.com', 'CORP_HR', 10, 5, 1);
