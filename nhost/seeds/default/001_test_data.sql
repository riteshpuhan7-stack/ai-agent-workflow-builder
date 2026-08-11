-- Sample seed data for testing

-- Create test organizations
INSERT INTO organizations (id, name, monthly_quota, monthly_used) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Organization A', 1000, 0),
  ('00000000-0000-0000-0000-000000000002', 'Organization B', 500, 0);

-- Note: After creating users via Nhost auth, add org_members entries like:
-- INSERT INTO org_members (org_id, user_id, role) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'user-uuid-from-auth', 'owner');
