import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import Badge from '@/components/Badge'
import StepIcon, { stepLabel, stepColor } from '@/components/StepIcon'
import { useOrg } from '@/hooks/useOrg'
import { getGraphQLClient } from '@/lib/graphql-client'
import { Workflow, WorkflowStep, WorkflowTrigger, WorkflowRun } from '@/lib/types'

export default function WorkflowDetail() {
  const router = useRouter()
  const { id } = router.query
  const { org } = useOrg()
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [triggers, setTriggers] = useState<WorkflowTrigger[]>([])
  const [recentRuns, setRecentRuns] = useState<WorkflowRun[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('nhost_jwt_token')) { router.push('/login'); return }
    if (id) loadWorkflow()
  }, [id, router])

  const loadWorkflow = async () => {
    try {
      const client = getGraphQLClient()
      const data: any = await client.request(`
        query GetWorkflow($id: uuid!) {
          workflows_by_pk(id: $id) {
            id org_id name description created_at updated_at
            workflow_steps(order_by: { position: asc }) { id workflow_id position type config created_at }
            workflow_triggers { id workflow_id type config created_at }
            workflow_runs(order_by: { started_at: desc }, limit: 5) {
              id status started_at completed_at error
            }
          }
        }
      `, { id })

      const wf = data.workflows_by_pk
      if (wf) {
        setWorkflow(wf)
        setSteps(wf.workflow_steps || [])
        setTriggers(wf.workflow_triggers || [])
        setRecentRuns(wf.workflow_runs || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleTriggerRun = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/trigger-workflow-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { workflow_id: id } })
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/workflows/${id}/runs/${data.workflow_run_id}`)
      } else {
        alert(data.error || 'Failed to start workflow')
      }
    } catch (err) {
      alert('Failed to start workflow')
    } finally {
      setRunning(false)
    }
  }

  if (loading) return <Layout><div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-gray-500)' }}>Loading...</div></Layout>
  if (!workflow) return <Layout><div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-gray-500)' }}>Workflow not found</div></Layout>

  const canEdit = org?.role === 'owner' || org?.role === 'editor'
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhook-trigger`

  return (
    <Layout>
      <div style={{ marginBottom: '24px' }}>
        <button onClick={() => router.push('/workflows')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '13px', padding: 0, marginBottom: '8px' }}>
          ← Back to Workflows
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '700' }}>{workflow.name}</h1>
            {workflow.description && <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-gray-500)' }}>{workflow.description}</p>}
          </div>
          {canEdit && (
            <button onClick={handleTriggerRun} disabled={running}
              style={{
                padding: '10px 20px',
                backgroundColor: running ? 'var(--color-gray-400)' : 'var(--color-success)',
                color: 'white', border: 'none', borderRadius: '8px',
                fontSize: '14px', fontWeight: '600', cursor: running ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}>
              {running ? 'Starting...' : '▶ Run Workflow'}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Steps */}
        <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--color-gray-200)' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Steps ({steps.length})</h2>
          {steps.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-gray-400)' }}>No steps configured</div>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {steps.map((step, i) => (
                <div key={step.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px', backgroundColor: 'var(--color-gray-50)',
                  borderRadius: '8px', border: '1px solid var(--color-gray-200)'
                }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-gray-400)', fontWeight: '600', width: '20px', textAlign: 'center' }}>{i + 1}</span>
                  <StepIcon type={step.type} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: stepColor(step.type) }}>{stepLabel(step.type)}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-gray-500)', maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {JSON.stringify(step.config).substring(0, 100)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'grid', gap: '16px' }}>
          {/* Triggers */}
          <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--color-gray-200)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '600' }}>Triggers</h3>
            {triggers.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--color-gray-400)' }}>No triggers</div>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {triggers.map(t => (
                  <div key={t.id} style={{ padding: '8px 12px', backgroundColor: 'var(--color-info-bg)', borderRadius: '6px', fontSize: '13px', fontWeight: '500', color: 'var(--color-info)' }}>
                    {t.type === 'manual' ? '⚡ Manual' : t.type === 'webhook' ? '🔗 Webhook' : t.type}
                  </div>
                ))}
              </div>
            )}
            {triggers.some(t => t.type === 'webhook') && (
              <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'var(--color-gray-50)', borderRadius: '6px', fontSize: '11px', color: 'var(--color-gray-500)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                POST {webhookUrl}
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--color-gray-200)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '600' }}>Info</h3>
            <div style={{ fontSize: '13px', color: 'var(--color-gray-500)', display: 'grid', gap: '8px' }}>
              <div>Created: {new Date(workflow.created_at).toLocaleDateString()}</div>
              <div>Updated: {new Date(workflow.updated_at).toLocaleDateString()}</div>
            </div>
          </div>

          {/* Recent Runs */}
          <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--color-gray-200)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '600' }}>Recent Runs</h3>
            {recentRuns.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--color-gray-400)', textAlign: 'center', padding: '12px' }}>No runs yet</div>
            ) : (
              <div style={{ display: 'grid', gap: '6px' }}>
                {recentRuns.map(run => (
                  <div key={run.id} onClick={() => router.push(`/workflows/${id}/runs/${run.id}`)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', backgroundColor: 'var(--color-gray-50)', borderRadius: '6px', cursor: 'pointer' }}>
                    <div style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>{new Date(run.started_at).toLocaleString()}</div>
                    <Badge status={run.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
