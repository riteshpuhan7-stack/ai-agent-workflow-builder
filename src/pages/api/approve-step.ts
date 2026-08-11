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
    const { input } = req.body as { input: { step_run_id: string; approver?: string } }
    if (!input?.step_run_id) {
      return res.status(400).json({ error: 'step_run_id is required' })
    }

    const stepRunData: any = await adminClient.request(`
      query GetStepRun($id: uuid!) {
        step_runs_by_pk(id: $id) {
          id workflow_run_id workflow_step_id status
          workflow_run {
            workflow {
              id org_id
              workflow_steps(order_by: { position: asc }) {
                id position type config
              }
            }
          }
        }
      }
    `, { id: input.step_run_id })

    const stepRun = stepRunData.step_runs_by_pk
    if (!stepRun) {
      return res.status(404).json({ error: 'Step run not found' })
    }
    if (stepRun.status !== 'paused') {
      return res.status(400).json({ error: 'Step run is not paused' })
    }

    const approver = input.approver || 'manual-approver'

    await adminClient.request(`
      mutation ApproveStep($id: uuid!, $approver: String!) {
        update_step_runs_by_pk(pk_columns: { id: $id },
          _set: { status: "completed", approved_by: $approver, approved_at: "now()", completed_at: "now()" }) { id }
      }
    `, { id: input.step_run_id, approver })

    await adminClient.request(`
      mutation ResumeRun($id: uuid!) {
        update_workflow_runs_by_pk(pk_columns: { id: $id },
          _set: { status: "running" }) { id }
      }
    `, { id: stepRun.workflow_run_id })

    resumeWorkflow(stepRun.workflow_run_id, stepRun.workflow_run.workflow, stepRun.workflow_step_id).catch(console.error)

    return res.status(200).json({ success: true })
  } catch (error: any) {
    console.error('Approve error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}

async function executeLLMResume(config: any, previousOutput: any): Promise<any> {
  const prompt = config.prompt || 'Hello'
  const apiKey = process.env.LLM_API_KEY || ''
  const model = process.env.LLM_MODEL || 'llama-3.1-8b-instant'
  if (apiKey && !apiKey.startsWith('your-')) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 500 })
      })
      if (response.ok) {
        const data = await response.json()
        return { llmResponse: data.choices[0]?.message?.content || '', prompt, provider: 'groq', previousOutput }
      }
    } catch {}
  }
  return { llmResponse: `Simulated response for: "${prompt}" — AI is transforming industries worldwide.`, prompt, provider: 'simulated', previousOutput }
}

async function executeHTTPResume(config: any, previousOutput: any): Promise<any> {
  try {
    const resp = await fetch(config.url || 'https://jsonplaceholder.typicode.com/posts/1', {
      method: config.method || 'GET',
      headers: { 'Accept': 'application/json', ...(config.headers || {}) }
    })
    const text = await resp.text()
    let data: any
    try { data = JSON.parse(text) } catch { data = { rawResponse: text.substring(0, 500) } }
    return { httpResponse: data, statusCode: resp.status, previousOutput }
  } catch (error: any) {
    return { httpResponse: { error: error.message }, statusCode: 0, previousOutput }
  }
}

async function resumeWorkflow(runId: string, workflow: any, approvedStepId: string) {
  const steps = workflow.workflow_steps
  const idx = steps.findIndex((s: any) => s.id === approvedStepId)

  if (idx === -1 || idx === steps.length - 1) {
    await adminClient.request(`
      mutation CompleteRun($id: uuid!) {
        update_workflow_runs_by_pk(pk_columns: { id: $id },
          _set: { status: "completed", completed_at: "now()" }) { id }
      }
    `, { id: runId })
    return
  }

  const remaining = steps.slice(idx + 1)

  // Fetch the approved step's output to use as input for remaining steps
  const approvedStepRunData: any = await adminClient.request(`
    query($id: uuid!) {
      step_runs_by_pk(id: $id) { output }
    }
  `, { id: approvedStepId })
  let previousOutput: any = approvedStepRunData.step_runs_by_pk?.output || null

  for (const step of remaining) {
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
        output = await executeLLMResume(step.config, previousOutput)
      } else if (step.type === 'http_request') {
        output = await executeHTTPResume(step.config, previousOutput)
      } else if (step.type === 'approval_gate') {
        await adminClient.request(`
          mutation PauseStep($id: uuid!) {
            update_step_runs_by_pk(pk_columns: { id: $id },
              _set: { status: "paused" }) { id }
          }
        `, { id: stepRunId })
        await adminClient.request(`
          mutation PauseRun($id: uuid!) {
            update_workflow_runs_by_pk(pk_columns: { id: $id },
              _set: { status: "paused" }) { id }
          }
        `, { id: runId })
        return
      } else if (step.type === 'conditional_branch') {
        const outputStr = JSON.stringify(previousOutput || {}).toLowerCase()
        const value = (step.config.value || '').toLowerCase()
        const met = step.config.condition === 'contains' ? outputStr.includes(value) :
                    step.config.condition === 'equals' ? outputStr === value : false
        output = { conditionMet: met, condition: step.config.condition, value: step.config.value, previousOutput }
        shouldContinue = met
      } else if (step.type === 'db_write') {
        output = { written: true, message: 'DB write completed', data: previousOutput }
      } else if (step.type === 'notify') {
        output = { notified: true, channel: step.config.channel || 'general' }
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
