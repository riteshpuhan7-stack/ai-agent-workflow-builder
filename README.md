# AI Agent Workflow Builder

A mini n8n-style workflow builder for AI-agent workflows built with Next.js, Hasura, and Nhost.

## Features

- **Workflow Management**: Create, edit, and manage AI workflows
- **Step Types**: LLM calls, HTTP requests, conditional branches, approval gates, notifications, database writes
- **Execution Engine**: Real-time workflow execution with status tracking
- **Approval Gates**: Pause workflows for manual approval before continuing
- **Webhooks**: Trigger workflows via HTTP webhooks
- **Organization-based Access**: Multi-tenant support with role-based permissions (owner, editor, viewer)
- **Quota Management**: Organization-level monthly call quotas
- **Live Updates**: Real-time execution status via GraphQL subscriptions
- **Security**: Hasura row-level permissions and backend authorization checks

## Tech Stack

- **Frontend**: Next.js + TypeScript + React
- **Backend**: Nhost (Hasura + PostgreSQL)
- **Database**: PostgreSQL with migrations
- **API**: GraphQL via Hasura
- **Auth**: Nhost authentication
- **LLM Provider**: Groq (configurable via environment)

## Quick Start

### 1. Prerequisites

- Node.js 18+
- Docker (for local Nhost setup)
- npm or yarn

### 2. Clone & Install

```bash
git clone <your-repo>
cd ai-workflow-builder
npm install
```

### 3. Environment Setup

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_NHOST_URL=http://localhost:1337
NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:8080/v1/graphql
NHOST_ADMIN_SECRET=your-admin-secret
LLM_API_KEY=your-groq-api-key
LLM_PROVIDER=groq
LLM_MODEL=mixtral-8x7b-32768
NODE_ENV=development
```

### 4. Nhost Setup

For local development with Nhost, follow the [Nhost CLI setup guide](https://docs.nhost.io/guides/cli):

```bash
# Install Nhost CLI
npm install -g nhost

# Initialize (if needed)
nhost init

# Start local Nhost services
nhost up
```

This starts PostgreSQL and Hasura at:
- Hasura Console: http://localhost:8080
- GraphQL API: http://localhost:8080/v1/graphql

### 5. Apply Database Schema

The migrations are in `nhost/migrations/default/`. Apply them through Hasura:

1. Open Hasura console: http://localhost:8080
2. Go to "Migrations" tab
3. Apply pending migrations

Or via CLI:
```bash
nhost db migrate up
```

### 6. Track Tables & Set Permissions

1. In Hasura console, go to "Data" tab
2. Track all tables: `organizations`, `org_members`, `workflows`, `workflow_steps`, `workflow_triggers`, `workflow_runs`, `step_runs`
3. Permissions are configured in `nhost/metadata/databases/default/tables/public_tables.yaml`

### 7. Start Frontend

```bash
npm run dev
```

Frontend runs at http://localhost:3000

### 8. Create Test Data

1. Sign up at http://localhost:3000/login
2. Create an organization (admin endpoint or manual DB insert)
3. Create users and org members with different roles
4. Start creating workflows

### 9. Trigger a Workflow

**Via UI:**
- Go to workflow detail page → Click "Run Workflow"

**Via Webhook:**
```bash
curl -X POST http://localhost:3000/api/webhook-trigger \
  -H "Content-Type: application/json" \
  -d '{"workflow_id": "your-workflow-uuid", "payload": {}}'
```

### 10. Test Approval Gate

1. Create a workflow with an approval_gate step
2. Trigger it
3. Workflow pauses at approval gate
4. As owner/editor, click "Approve & Resume"
5. Workflow continues to remaining steps

## Testing Cross-Organization Security

1. Create Organization A with User 1 (owner)
2. Create Organization B with User 2 (owner)
3. Login as User 1, create a workflow in Org A
4. Login as User 2
5. Try to access Org A workflow by guessing ID in URL
6. **Result**: Access denied (403 or permission error)

## Workflow Execution Flow

1. **Trigger**: Manual button, webhook, or scheduled event
2. **Authorization**: Check user role in organization
3. **Quota Check**: Verify monthly usage quota
4. **Create Run**: Insert workflow_run record with status "running"
5. **Execute Steps**:
   - Create step_run record
   - Execute step (LLM call, HTTP request, etc.)
   - Update step_run with output
   - If approval_gate: pause and wait for approval
   - If conditional_branch: evaluate and branch
6. **Complete**: Mark workflow_run as completed or failed

## Step Types

### LLM Call
- Calls external LLM API (Groq, OpenRouter, etc.)
- Config: `{"prompt": "Your prompt here"}`
- Includes retry logic for failed requests

### HTTP Request
- Makes HTTP call to external endpoint
- Config: `{"url": "https://...", "method": "POST", "body": {...}}`
- Supports retries

### Conditional Branch
- Evaluates previous step output
- Config: `{"condition": "contains", "value": "search-term"}`
- Conditions: `contains`, `equals`

### Approval Gate
- Pauses workflow for manual approval
- Only owner/editor can approve
- Resumes from next step after approval

### Notify (Owner only)
- Sends notification (placeholder for event triggers)

### DB Write (Owner only)
- Writes results to database (placeholder)

## Permission Model

### Organization Roles

- **Owner**: Full control, can manage members, approve workflows
- **Editor**: Can create/edit workflows, trigger runs, approve workflows
- **Viewer**: Read-only access

### Row-Level Security

All queries are filtered by organization membership:
- Users can only see/access data in organizations they're members of
- Permissions enforced at Hasura level (not just frontend)
- Backend Actions verify organization membership + role

### Step-Level Restrictions

- `db_write`, `notify`, and webhook triggers are owner-only
- Backend handler checks role before allowing these steps

## Deployment

### Vercel (Next.js Frontend)

1. Push to GitHub
2. Connect repo to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Nhost (Backend)

Deploy Hasura & PostgreSQL on Nhost cloud:

1. Create account at https://nhost.io
2. Create project
3. Apply migrations and metadata
4. Update `.env` with cloud endpoint

## Project Structure

```
.
├── nhost/
│   ├── migrations/           # Database migrations
│   └── metadata/            # Hasura metadata & permissions
├── src/
│   ├── pages/
│   │   ├── _app.tsx        # App wrapper with Nhost provider
│   │   ├── index.tsx       # Home (redirects to workflows)
│   │   ├── login.tsx       # Login page
│   │   └── workflows/
│   │       ├── index.tsx              # Workflow list
│   │       ├── new.tsx                # Create workflow
│   │       ├── [id]/index.tsx         # Workflow detail
│   │       └── [workflowId]/runs/[runId].tsx  # Execution viewer
│   ├── pages/api/
│   │   ├── trigger-workflow-run.ts   # Start workflow
│   │   ├── approve-step.ts           # Approve paused step
│   │   └── webhook-trigger.ts        # Webhook endpoint
│   ├── lib/
│   │   ├── types.ts          # TypeScript types
│   │   ├── nhost.ts          # Nhost client
│   │   ├── org-context.ts    # Organization context
│   │   └── graphql-client.ts # GraphQL client factory
│   └── styles/
│       └── globals.css       # Global styles
├── package.json
├── tsconfig.json
├── next.config.js
└── README.md
```

## Common Issues

### "Cannot find user" when creating workflow
- Ensure user is an org_member with correct role
- Check org_members table in Hasura

### "Quota exceeded" error
- Check organization.monthly_used vs monthly_quota
- Reset quota or increase limit in database

### Webhook not triggering workflow
- Verify workflow_id is valid UUID
- Check webhook trigger exists in workflow_triggers
- Ensure authorization header is not required for webhook endpoint

### Approval gate not working
- Ensure step is actually paused (status = 'paused')
- Confirm user has owner or editor role
- Check browser console for API errors

## Development Notes

- Hasura Actions are called from API routes (`src/pages/api/`)
- GraphQL queries executed server-side for authorization
- Frontend uses GraphQL subscriptions for real-time updates
- All external API calls include retry logic
- Database writes are wrapped in transactions where possible

## License

MIT
