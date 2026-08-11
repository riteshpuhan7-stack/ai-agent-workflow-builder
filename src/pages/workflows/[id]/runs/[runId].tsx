import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import Badge from '@/components/Badge'
import StepIcon, { stepLabel, stepColor } from '@/components/StepIcon'
import { useOrg } from '@/hooks/useOrg'
import { getGraphQLClient } from '@/lib/graphql-client'
import { StepRun, WorkflowRun } from '@/lib/types'

export default function WorkflowExecution() {
  const router = useRouter()
  const { id, runId } = router.query
  const { org } = useOrg()
  const [run, setRun] = useState<WorkflowRun | null>(null)
  const [stepRuns, setStepRuns] = useState<StepRun[]>([])
  const [stepNames, setStepNames] = useState<Record<string, { type: string; config: any; position: number }>>({})
  const [loading, setLoading] = useState(true)
  const [pausedStepId, setPausedStepId] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [workflowName, setWorkflowName] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('nhost_jwt_token')) { router.push('/login'); return }
    if (runId) {
      loadExecution()
      const interval = setInterval(loadExecution, 2000)
      return () => clearInterval(interval)
    }
  }, [runId, router])

  const loadExecution = async () => {
    try {
      const client = getGraphQLClient()

      const data: any = await client.request(`
        query GetRun($id: uuid!) {
          workflow_runs_by_pk(id: $id) {
            id workflow_id status started_at completed_at error
            workflow { name }
            step_runs(order_by: { workflow_step_id: asc }) {
              id workflow_step_id status input output error
              attempt_count approved_by approved_at started_at completed_at
            }
          }
        }
      `, { id: runId })

      const wr = data.workflow_runs_by_pk
      if (!wr) { setLoading(false); return }

      setRun(wr)
      setWorkflowName(wr.workflow?.name || '')

      // Load step definitions for names/types and sort step runs by position
      const wfData: any = await client.request(`
        query($id: uuid!) {
          workflows_by_pk(id: $id) {
            workflow_steps(order_by: { position: asc }) { id type config }
          }
        }
      `, { id: wr.workflow_id })

      const nameMap: Record<string, { type: string; config: any; position: number }> = {}
      wfData.workflows_by_pk?.workflow_steps?.forEach((s: any, i: number) => {
        nameMap[s.id] = { type: s.type, config: s.config, position: i }
      })
      setStepNames(nameMap)

      const sorted = [...(wr.step_runs || [])].sort((a: any, b: any) => {
        const posA = nameMap[a.workflow_step_id]?.position ?? 999
        const posB = nameMap[b.workflow_step_id]?.position ?? 999
        return posA - posB
      })
      setStepRuns(sorted)

      const paused = wr.step_runs?.find((sr: StepRun) => sr.status === 'paused')
      setPausedStepId(paused?.id || null)
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!pausedStepId) return
    setApproving(true)
    try {
      const res = await fetch('/api/approve-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { step_run_id: pausedStepId, approver: localStorage.getItem('user_email') || 'user' } })
      })
      if (res.ok) {
        setPausedStepId(null)
        await loadExecution()
      } else {
        const data = await res.json()
        alert(data.error || 'Approval failed')
      }
    } catch {
      alert('Failed to approve')
    } finally {
      setApproving(false)
    }
  }

  if (loading) return <Layout><div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-gray-500)' }}>Loading execution...</div></Layout>
  if (!run) return <Layout><div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-gray-500)' }}>Execution not found</div></Layout>

  const canApprove = org?.role === 'owner' || org?.role === 'editor'

  return (
    <Layout>
      <div style={{ marginBottom: '24px' }}>
        <button onClick={() => router.push(`/workflows/${id}`)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '13px', padding: 0, marginBottom: '8px' }}>
          ← Back to {workflowName}
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>Execution</h1>
          <Badge status={run.status} />
        </div>
      </div>

      {/* Run Info */}
      <div style={{ padding: '16px 20px', backgroundColor: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--color-gray-200)', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', fontSize: '13px' }}>
        <div><span style={{ color: 'var(--color-gray-400)' }}>Run ID:</span><div style={{ fontWeight: '500', fontFamily: 'monospace', fontSize: '11px', marginTop: '2px' }}>{run.id.substring(0, 8)}...</div></div>
        <div><span style={{ color: 'var(--color-gray-400)' }}>Started:</span><div style={{ fontWeight: '500', marginTop: '2px' }}>{new Date(run.started_at).toLocaleString()}</div></div>
        {run.completed_at && <div><span style={{ color: 'var(--color-gray-400)' }}>Completed:</span><div style={{ fontWeight: '500', marginTop: '2px' }}>{new Date(run.completed_at).toLocaleString()}</div></div>}
        {run.error && <div><span style={{ color: 'var(--color-danger)' }}>Error:</span><div style={{ fontWeight: '500', color: 'var(--color-danger)', marginTop: '2px' }}>{run.error}</div></div>}
      </div>

      {/* Approval Banner */}
      {pausedStepId && canApprove && (
        <div style={{
          padding: '16px 20px', backgroundColor: 'var(--color-warning-bg)',
          borderRadius: 'var(--radius)', border: '1px solid #fde68a',
          marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--color-warning)', marginBottom: '4px' }}>⏸ Approval Required</div>
            <div style={{ fontSize: '13px', color: 'var(--color-gray-600)' }}>This workflow is paused and waiting for approval to continue.</div>
          </div>
          <button onClick={handleApprove} disabled={approving}
            style={{
              padding: '10px 24px',
              backgroundColor: approving ? 'var(--color-gray-300)' : 'var(--color-warning)',
              color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: '600', cursor: approving ? 'default' : 'pointer',
              whiteSpace: 'nowrap'
            }}>
            {approving ? 'Approving...' : '✓ Approve & Resume'}
          </button>
        </div>
      )}

      {/* Step Timeline */}
      <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--color-gray-200)' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Step Execution Timeline</h2>

        {stepRuns.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-gray-400)' }}>No steps executed yet</div>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {stepRuns.map((sr, i) => {
              const meta = stepNames[sr.workflow_step_id]
              const typeName = meta?.type || sr.workflow_step_id
              const configStr = meta?.config ? JSON.stringify(meta.config) : ''

              return (
                <div key={sr.id} style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: `2px solid ${
                    sr.status === 'completed' ? 'var(--color-success)' :
                    sr.status === 'running' ? 'var(--color-info)' :
                    sr.status === 'paused' ? 'var(--color-warning)' :
                    sr.status === 'failed' ? 'var(--color-danger)' :
                    'var(--color-gray-200)'
                  }`,
                  backgroundColor: sr.status === 'running' ? 'var(--color-info-bg)' :
                    sr.status === 'paused' ? 'var(--color-warning-bg)' :
                    sr.status === 'failed' ? 'var(--color-danger-bg)' :
                    sr.status === 'completed' ? 'var(--color-success-bg)' : 'white'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: sr.output || sr.error ? '12px' : 0 }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-gray-400)', fontWeight: '600' }}>Step {i + 1}</span>
                    <StepIcon type={typeName} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: stepColor(typeName) }}>{stepLabel(typeName)}</div>
                    </div>
                    <Badge status={sr.status} />
                  </div>

                  {sr.output && (
                    <div style={{ marginTop: '8px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', maxHeight: '150px', overflow: 'auto', wordBreak: 'break-word' }}>
                      {typeof sr.output === 'object' ? JSON.stringify(sr.output, null, 2) : String(sr.output)}
                    </div>
                  )}

                  {sr.error && (
                    <div style={{ marginTop: '8px', padding: '10px', backgroundColor: 'rgba(220,38,38,0.05)', borderRadius: '6px', fontSize: '12px', color: 'var(--color-danger)' }}>
                      {sr.error}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '11px', color: 'var(--color-gray-400)' }}>
                    {sr.started_at && <span>Started: {new Date(sr.started_at).toLocaleTimeString()}</span>}
                    {sr.completed_at && <span>Completed: {new Date(sr.completed_at).toLocaleTimeString()}</span>}
                    {sr.attempt_count > 0 && <span>Attempts: {sr.attempt_count}</span>}
                    {sr.approved_by && <span>Approved by: {sr.approved_by}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
