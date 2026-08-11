# AI Workflow Builder - Setup Instructions

## Complete Setup Guide

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create `.env.local` from example:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
NEXT_PUBLIC_NHOST_URL=http://localhost:1337
NEXT_PUBLIC_NHOST_SUBDOMAIN=
NEXT_PUBLIC_NHOST_REGION=us-east-1
NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:8080/v1/graphql
NEXT_PUBLIC_APP_URL=http://localhost:3000
NHOST_ADMIN_SECRET=nhost-admin-secret
LLM_API_KEY=gsk_your_groq_api_key_here
LLM_PROVIDER=groq
LLM_MODEL=mixtral-8x7b-32768
```

**Get Groq API Key:**
1. Visit https://console.groq.com/
2. Sign up/login
3. Create API key in settings
4. Copy to `.env.local`

### 3. Start Nhost Backend

Install Nhost CLI:
```bash
npm install -g nhost
```

Start local Nhost (PostgreSQL + Hasura):
```bash
nhost up
```

This starts:
- Hasura Console: http://localhost:8080
- GraphQL API: http://localhost:8080/v1/graphql
- PostgreSQL: localhost:5432

### 4. Apply Database Migrations

Open Hasura Console at http://localhost:8080 and:

1. Go to "Data" tab
2. Click "Migrations" in sidebar
3. Apply pending migrations (00001_initial_schema.up.sql)

Or via CLI:
```bash
hasura migrate apply --database-name default
```

### 5. Track Tables & Relationships

In Hasura Console:

1. Go to "Data" → "public" schema
2. Track all tables:
   - organizations
   - org_members
   - workflows
   - workflow_steps
   - workflow_triggers
   - workflow_runs
   - step_runs

3. Track all foreign key relationships (Hasura auto-suggests)

4. Import metadata from `nhost/metadata/databases/default/tables/public_tables.yaml`

### 6. Configure Hasura Permissions

Permissions are defined in `public_tables.yaml`. Apply them:

1. In Hasura Console, go to each table
2. Click "Permissions" tab
3. Add roles: `owner`, `editor`, `viewer`
4. Apply select/insert/update permissions as per metadata file

Or apply all metadata at once:
```bash
hasura metadata apply
```

### 7. Start Frontend

```bash
npm run dev
```

Access at http://localhost:3000

### 8. Create Test Users & Organizations

**Create User 1 (Org A Owner):**
1. Go to http://localhost:3000/login
2. Click sign up (if available) or use Hasura Console
3. Note the user ID from auth.users table

**Insert Org A & Member:**
```sql
INSERT INTO organizations (id, name) VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Organization A');

INSERT INTO org_members (org_id, user_id, role) VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user-1-id-here', 'owner');
```

**Create User 2 (Org B Owner):**
```sql
INSERT INTO organizations (id, name) VALUES 
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Organization B');

INSERT INTO org_members (org_id, user_id, role) VALUES 
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'user-2-id-here', 'owner');
```

### 9. Test End-to-End Workflow

**As User 1 (Org A):**

1. Login at http://localhost:3000
2. Click "Create Workflow"
3. Name: "AI Test Workflow"
4. Add steps:
   - **Step 1**: llm_call with config: `{"prompt": "What is AI?"}`
   - **Step 2**: conditional_branch with config: `{"condition": "contains", "value": "intelligence"}`
   - **Step 3**: approval_gate with config: `{}`
   - **Step 4**: llm_call with config: `{"prompt": "Explain more"}`
5. Add trigger: Manual (default)
6. Save workflow
7. Click "Run Workflow"
8. Watch execution in real-time
9. When paused at approval gate, click "Approve & Resume"
10. Verify workflow completes

**Test Webhook Trigger:**

```bash
curl -X POST http://localhost:3000/api/webhook-trigger \
  -H "Content-Type: application/json" \
  -d '{"workflow_id": "your-workflow-id-from-ui"}'
```

### 10. Test Cross-Org Security

**As User 2 (Org B):**

1. Login as User 2
2. Try to access Org A workflow:
   - Copy workflow URL from User 1's session
   - Paste in User 2's browser
3. **Expected**: Access denied or 404
4. Try direct GraphQL query with Org A workflow_id
5. **Expected**: Empty result or permission error

**Verify via GraphQL:**
```graphql
query {
  workflows(where: {id: {_eq: "org-a-workflow-id"}}) {
    id
    name
  }
}
```

Should return empty for User 2.

### 11. Verify Quota System

1. Check organization quota:
   ```sql
   SELECT name, monthly_used, monthly_quota FROM organizations;
   ```

2. Run workflow multiple times
3. Observe `monthly_used` incrementing
4. Set quota to current usage and try running again
5. **Expected**: "Quota exceeded" error

### 12. Test Role Permissions

**Create Editor in Org A:**
```sql
INSERT INTO org_members (org_id, user_id, role) VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user-3-id', 'editor');
```

**As Editor:**
- Can create workflows ✓
- Can trigger workflows ✓
- Can approve workflows ✓
- Cannot add db_write or notify steps (owner-only)

**Create Viewer:**
```sql
INSERT INTO org_members (org_id, user_id, role) VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user-4-id', 'viewer');
```

**As Viewer:**
- Can view workflows ✓
- Cannot create workflows ✗
- Cannot trigger workflows ✗
- Cannot approve ✗

## Troubleshooting

### "Cannot connect to GraphQL endpoint"
- Ensure Nhost is running: `nhost up`
- Check port 8080 is not in use
- Verify NEXT_PUBLIC_GRAPHQL_ENDPOINT in `.env.local`

### "Table not found"
- Apply migrations in Hasura Console
- Track all tables in Data tab

### "Permission denied"
- Apply metadata with permissions
- Check user is org_member
- Verify role is correct

### LLM calls failing
- Verify LLM_API_KEY is set
- Check Groq API quota
- Test API key: `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $LLM_API_KEY"`

### Workflow not starting
- Check quota: `SELECT monthly_used, monthly_quota FROM organizations`
- Verify user role (must be owner or editor)
- Check browser console for errors

## Production Deployment

### Nhost Cloud

1. Create project at https://app.nhost.io
2. Push migrations: `nhost deploy`
3. Update `.env.local` with cloud URLs

### Vercel (Frontend)

1. Push to GitHub
2. Import to Vercel
3. Set environment variables
4. Deploy

## VS Code Commands

```bash
# Install dependencies
npm install

# Start development
npm run dev

# Type check
npm run type-check

# Build for production
npm run build

# Start production server
npm start
```

## Project Complete

All features implemented:
✓ Organizations with quotas
✓ Role-based permissions (owner/editor/viewer)
✓ Workflow builder with 6 step types
✓ Real-time execution tracking
✓ Approval gates with resume
✓ Webhook triggers
✓ LLM integration with retry
✓ Cross-org security
✓ GraphQL subscriptions
✓ Hasura row-level permissions
✓ Backend authorization checks
