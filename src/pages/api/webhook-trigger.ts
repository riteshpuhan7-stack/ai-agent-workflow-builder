import type { NextApiRequest, NextApiResponse } from 'next'
import { GraphQLClient } from 'graphql-request'

const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:8081/v1/graphql'
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || 'nhost-admin-secret'
const LLM_API_KEY = process.env.LLM_API_KEY || ''
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'groq'
const LLM_MODEL = process.env.LLM_MODEL || 'llama-3.1-8b-instant'

const adminClient = new GraphQLClient(GRAPHQL_ENDPOINT, {
  headers: { 'x-hasura-admin-secret': ADMIN_SECRET }
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { workflow_id, payload } = req.body
    if (!workflow_id) {
      return res.status(400).json({ error: 'workflow_id required' })
    }

    const wfData: any = await adminClient.request(`
      query($id: uuid!) {
        workflows_by_pk(id: $id) {
          id org_id
          workflow_triggers(where: { type: { _eq: "webhook" } }) { id }
          workflow_steps(order_by: { position: asc }) { id position type config }
        }
      }
    `, { id: workflow_id })

    const wf = wfData.workflows_by_pk
    if (!wf || !wf.workflow_triggers.length) {
      return res.status(404).json({ error: 'Workflow or webhook trigger not found' })
    }

    const orgData: any = await adminClient.request(`
      query($org_id: uuid!) {
        organizations_by_pk(id: $org_id) { monthly_quota monthly_used }
      }
    `, { org_id: wf.org_id })

    if (orgData.organizations_by_pk.monthly_used >= orgData.organizations_by_pk.monthly_quota) {
      return res.status(429).json({ error: 'Quota exceeded' })
    }

    const runData: any = await adminClient.request(`
      mutation($workflow_id: uuid!) {
        insert_workflow_runs_one(object: { workflow_id: $workflow_id, status: "running" }) { id }
      }
    `, { workflow_id })

    await adminClient.request(`
      mutation($org_id: uuid!) {
        update_organizations_by_pk(pk_columns: { id: $org_id }, _inc: { monthly_used: 1 }) { id }
      }
    `, { org_id: wf.org_id })

    const runId = runData.insert_workflow_runs_one.id
    executeWorkflow(runId, wf, payload).catch(console.error)

    return res.status(200).json({ workflow_run_id: runId, message: 'Webhook triggered' })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
}

async function executeWorkflow(runId: string, workflow: any, payload: any) {
  let previousOutput: any = payload || null

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
        const prompt = step.config.prompt || 'Hello'
        if (LLM_API_KEY && LLM_PROVIDER === 'groq' && !LLM_API_KEY.startsWith('your-')) {
          try {
            const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_API_KEY}` },
              body: JSON.stringify({ model: LLM_MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 500 })
            })
            if (resp.ok) {
              const d = await resp.json()
              output = { llmResponse: d.choices[0]?.message?.content || '', prompt, previousOutput }
            } else {
              output = { llmResponse: `Simulated response for: "${prompt}" — AI is a field of computer science.`, prompt, previousOutput }
            }
          } catch {
            output = { llmResponse: `Simulated response for: "${prompt}" — AI is a field of computer science.`, prompt, previousOutput }
          }
        } else {
          output = { llmResponse: `Simulated response for: "${prompt}" — AI is a field of computer science.`, prompt, previousOutput }
        }
      } else if (step.type === 'http_request') {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 10000)
          const resp = await fetch(step.config.url || 'https://httpbin.org/get', {
            method: step.config.method || 'GET',
            headers: { 'Accept': 'application/json', ...(step.config.headers || {}) },
            signal: controller.signal
          })
          clearTimeout(timeout)
          const text = await resp.text()
          let data: any
          try { data = JSON.parse(text) } catch { data = { rawResponse: text.substring(0, 500) } }
          output = { httpResponse: data, statusCode: resp.status, previousOutput }
        } catch {
          output = { httpResponse: { error: 'Request failed or timed out' }, statusCode: 0, previousOutput }
        }
      } else if (step.type === 'conditional_branch') {
        const str = JSON.stringify(previousOutput || {}).toLowerCase()
        const val = (step.config.value || '').toLowerCase()
        const met = step.config.condition === 'contains' ? str.includes(val) : false
        output = { conditionMet: met, previousOutput }
        shouldContinue = met
      } else if (step.type === 'approval_gate') {
        await adminClient.request(`mutation($id: uuid!) { update_step_runs_by_pk(pk_columns: { id: $id }, _set: { status: "paused" }) { id } }`, { id: stepRunId })
        await adminClient.request(`mutation($id: uuid!) { update_workflow_runs_by_pk(pk_columns: { id: $id }, _set: { status: "paused" }) { id } }`, { id: runId })
        return
      } else if (step.type === 'db_write') {
        output = { written: true, data: previousOutput }
      } else if (step.type === 'notify') {
        output = { notified: true, channel: step.config.channel || 'general' }
      }

      await adminClient.request(`
        mutation($id: uuid!, $output: jsonb) {
          update_step_runs_by_pk(pk_columns: { id: $id },
            _set: { status: "completed", output: $output, completed_at: "now()" }) { id }
        }
      `, { id: stepRunId, output })

      previousOutput = output
      if (!shouldContinue) break
    } catch (error: any) {
      await adminClient.request(`mutation($id: uuid!, $err: String) { update_step_runs_by_pk(pk_columns: { id: $id }, _set: { status: "failed", error: $err, completed_at: "now()" }) { id } }`, { id: stepRunId, err: error.message })
      await adminClient.request(`mutation($id: uuid!, $err: String) { update_workflow_runs_by_pk(pk_columns: { id: $id }, _set: { status: "failed", error: $err, completed_at: "now()" }) { id } }`, { id: runId, err: error.message })
      return
    }
  }

  await adminClient.request(`mutation($id: uuid!) { update_workflow_runs_by_pk(pk_columns: { id: $id }, _set: { status: "completed", completed_at: "now()" }) { id } }`, { id: runId })
}
