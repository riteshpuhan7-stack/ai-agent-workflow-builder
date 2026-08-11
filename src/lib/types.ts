export interface Workflow {
  id: string
  org_id: string
  name: string
  description?: string
  created_at: string
  updated_at: string
  workflow_steps?: WorkflowStep[]
  workflow_triggers?: WorkflowTrigger[]
}

export interface WorkflowStep {
  id: string
  workflow_id: string
  position: number
  type: 'llm_call' | 'http_request' | 'db_write' | 'notify' | 'conditional_branch' | 'approval_gate'
  config: Record<string, unknown>
  created_at: string
}

export interface WorkflowTrigger {
  id: string
  workflow_id: string
  type: 'manual' | 'webhook' | 'scheduled' | 'database'
  config: Record<string, unknown>
  created_at: string
}

export interface WorkflowRun {
  id: string
  workflow_id: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed'
  started_at: string
  completed_at?: string
  error?: string
  step_runs?: StepRun[]
}

export interface StepRun {
  id: string
  workflow_run_id: string
  workflow_step_id: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed'
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  attempt_count: number
  approved_by?: string
  approved_at?: string
  started_at?: string
  completed_at?: string
}

export interface Organization {
  id: string
  name: string
  monthly_quota: number
  monthly_used: number
  quota_reset_date: string
  created_at: string
  org_members?: OrgMember[]
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: 'owner' | 'editor' | 'viewer'
  created_at: string
}
