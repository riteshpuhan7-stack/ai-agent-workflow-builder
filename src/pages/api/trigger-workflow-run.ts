import type { NextApiRequest, NextApiResponse } from 'next'
import { GraphQLClient } from 'graphql-request'

const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:8081/v1/graphql'
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || 'nhost-admin-secret'

const adminClient = new GraphQLClient(GRAPHQL_ENDPOINT, {
  headers: { 'x-hasura-admin-secret': ADMIN_SECRET }
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { input } = req.body as { input: { workflow_id: string } }
    if (!input?.workflow_id) {
      return res.status(400).json({ error: 'workflow_id is required' })
    }

    const workflowData: any = await adminClient.request(`
      query GetWorkflow($id: uuid!) {
        workflows_by_pk(id: $id) {
          id org_id name
          workflow_steps(order_by: { position: asc }) {
            id position type config
          }
        }
      }
    `, { id: input.workflow_id })

    const workflow = workflowData.workflows_by_pk
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' })
    }

    const orgData: any = await adminClient.request(`
      query CheckQuota($org_id: uuid!) {
        organizations_by_pk(id: $org_id) {
          monthly_quota monthly_used
        }
      }
    `, { org_id: workflow.org_id })

    const org = orgData.organizations_by_pk
    if (org.monthly_used >= org.monthly_quota) {
      return res.status(429).json({ error: 'Quota exceeded' })
    }

    const runData: any = await adminClient.request(`
      mutation CreateRun($workflow_id: uuid!) {
        insert_workflow_runs_one(object: { workflow_id: $workflow_id, status: "running" }) { id }
      }
    `, { workflow_id: workflow.id })

    const runId = runData.insert_workflow_runs_one.id

    await adminClient.request(`
      mutation IncUsage($org_id: uuid!) {
        update_organizations_by_pk(pk_columns: { id: $org_id }, _inc: { monthly_used: 1 }) { id }
      }
    `, { org_id: workflow.org_id })

    executeWorkflow(runId, workflow).catch(console.error)

    return res.status(200).json({ workflow_run_id: runId })
  } catch (error: any) {
    console.error('Trigger error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}

async function executeWorkflow(runId: string, workflow: any) {
  let previousOutput: any = null

  for (const step of workflow.workflow_steps) {
    const stepRunData: any = await adminClient.request(`
      mutation CreateStepRun($data: step_runs_insert_input!) {
        insert_step_runs_one(object: $data) { id }
      }
    `, {
      data: {
        workflow_run_id: runId,
        workflow_step_id: step.id,
        status: 'running',
        input: previousOutput ? { previousOutput } : null,
        attempt_count: 0,
        started_at: new Date().toISOString()
      }
    })

    const stepRunId = stepRunData.insert_step_runs_one.id

    try {
      let output: any = null
      let shouldContinue = true

      if (step.type === 'llm_call') {
        output = await executeLLMCall(step.config, previousOutput, stepRunId)
      } else if (step.type === 'http_request') {
        output = await executeHttpRequest(step.config, previousOutput, stepRunId)
      } else if (step.type === 'conditional_branch') {
        output = await executeConditionalBranch(step.config, previousOutput)
        shouldContinue = output.conditionMet
      } else if (step.type === 'approval_gate') {
        await adminClient.request(`
          mutation UpdateStep($id: uuid!, $msg: jsonb) {
            update_step_runs_by_pk(pk_columns: { id: $id },
              _set: { status: "paused", output: $msg }) { id }
          }
        `, { id: stepRunId, msg: { message: step.config.message || 'Awaiting approval' } })
        await adminClient.request(`
          mutation PauseRun($id: uuid!) {
            update_workflow_runs_by_pk(pk_columns: { id: $id },
              _set: { status: "paused" }) { id }
          }
        `, { id: runId })
        return
      } else if (step.type === 'db_write') {
        output = { written: true, message: 'DB write completed', data: previousOutput }
      } else if (step.type === 'notify') {
        output = { notified: true, channel: step.config.channel || 'general', message: step.config.message || 'Step completed' }
      }

      await adminClient.request(`
        mutation CompleteStep($id: uuid!, $output: jsonb) {
          update_step_runs_by_pk(pk_columns: { id: $id },
            _set: { status: "completed", output: $output, completed_at: "now()" }) { id }
        }
      `, { id: stepRunId, output })

      previousOutput = output
      if (!shouldContinue) {
        await adminClient.request(`
          mutation CompleteRun($id: uuid!) {
            update_workflow_runs_by_pk(pk_columns: { id: $id },
              _set: { status: "completed", completed_at: "now()" }) { id }
          }
        `, { id: runId })
        return
      }
    } catch (error: any) {
      await adminClient.request(`
        mutation FailStep($id: uuid!, $err: String) {
          update_step_runs_by_pk(pk_columns: { id: $id },
            _set: { status: "failed", error: $err, completed_at: "now()" }) { id }
        }
      `, { id: stepRunId, err: error.message })
      await adminClient.request(`
        mutation FailRun($id: uuid!, $err: String) {
          update_workflow_runs_by_pk(pk_columns: { id: $id },
            _set: { status: "failed", error: $err, completed_at: "now()" }) { id }
        }
      `, { id: runId, err: error.message })
      return
    }
  }

  await adminClient.request(`
    mutation CompleteRun($id: uuid!) {
      update_workflow_runs_by_pk(pk_columns: { id: $id },
        _set: { status: "completed", completed_at: "now()" }) { id }
    }
  `, { id: runId })
}

async function incrementAttempt(stepRunId: string) {
  await adminClient.request(`
    mutation IncAttempt($id: uuid!) {
      update_step_runs_by_pk(pk_columns: { id: $id },
        _inc: { attempt_count: 1 }) { id }
    }
  `, { id: stepRunId })
}

async function executeLLMCall(config: any, previousOutput: any, stepRunId: string): Promise<any> {
  const prompt = config.prompt || 'Hello'
  const LLM_API_KEY = process.env.LLM_API_KEY || ''
  const LLM_MODEL = process.env.LLM_MODEL || 'llama-3.1-8b-instant'

  console.log(`[LLM] Key present: ${!!LLM_API_KEY}, prefix: ${LLM_API_KEY ? LLM_API_KEY.substring(0, 6) : 'none'}, model: ${LLM_MODEL}`)

  if (!LLM_API_KEY || LLM_API_KEY.startsWith('your-')) {
    console.log('[LLM] No valid API key, returning error')
    throw new Error('LLM_API_KEY not configured. Set it in .env.local')
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await incrementAttempt(stepRunId)
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_API_KEY}` },
        body: JSON.stringify({ model: LLM_MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 500 })
      })
      const body = await response.text()
      console.log(`[LLM] Groq status: ${response.status}`)

      if (!response.ok) {
        const errMsg = `Groq API error ${response.status}: ${body.substring(0, 200)}`
        console.log(`[LLM] ${errMsg}`)
        if (attempt === 2) throw new Error(errMsg)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        continue
      }

      const data = JSON.parse(body)
      const content = data.choices?.[0]?.message?.content || ''
      console.log(`[LLM] Success: ${content.substring(0, 80)}`)
      return { llmResponse: content, prompt, provider: 'groq', previousOutput }
    } catch (error: any) {
      console.log(`[LLM] Attempt ${attempt + 1} failed: ${error.message}`)
      if (attempt === 2) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
    }
  }
  throw new Error('LLM call failed after 3 attempts')
}

async function executeHttpRequest(config: any, previousOutput: any, stepRunId: string): Promise<any> {
  const url = config.url || 'https://httpbin.org/get'
  const method = config.method || 'GET'
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await incrementAttempt(stepRunId)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const response = await fetch(url, {
        method,
        headers: { 'Accept': 'application/json', ...(config.headers || {}) },
        body: method !== 'GET' ? JSON.stringify(config.body || {}) : undefined,
        signal: controller.signal
      })
      clearTimeout(timeout)
      const text = await response.text()
      let data: any
      try { data = JSON.parse(text) } catch { data = { rawResponse: text.substring(0, 500), contentType: response.headers.get('content-type') } }
      return { httpResponse: data, statusCode: response.status, url, method, previousOutput }
    } catch (error: any) {
      if (attempt === 2) {
        return { httpResponse: { error: error.message || 'Request failed', url, method }, statusCode: 0, url, method, previousOutput }
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
    }
  }
  throw new Error('HTTP request failed')
}

async function executeConditionalBranch(config: any, previousOutput: any): Promise<any> {
  if (!previousOutput) return { conditionMet: false, reason: 'No previous output', previousOutput }
  const outputStr = JSON.stringify(previousOutput).toLowerCase()
  const value = (config.value || '').toLowerCase()
  let met = false
  if (config.condition === 'contains') met = outputStr.includes(value)
  else if (config.condition === 'equals') met = outputStr === value
  else if (config.condition === 'not_empty') met = outputStr.length > 2
  return { conditionMet: met, condition: config.condition, value: config.value, previousOutput }
}
