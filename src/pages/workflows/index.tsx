import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import Badge from '@/components/Badge'
import StepIcon, { stepLabel } from '@/components/StepIcon'
import { useOrg } from '@/hooks/useOrg'
import { getGraphQLClient } from '@/lib/graphql-client'
import { Workflow } from '@/lib/types'

interface WorkflowWithMeta extends Workflow {
  step_count?: number
  latest_status?: string
}

export default function WorkflowsList() {
  const router = useRouter()
  const { org, loading: orgLoading } = useOrg()
  const [workflows, setWorkflows] = useState<WorkflowWithMeta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!localStorage.getItem('nhost_jwt_token')) { router.push('/login'); return }
  }, [router])

  useEffect(() => {
    if (org?.orgId) loadWorkflows()
  }, [org])

  const loadWorkflows = async () => {
    try {
      const client = getGraphQLClient()
      const data: any = await client.request(`
        query GetWorkflows($org_id: uuid!) {
          workflows(where: { org_id: { _eq: $org_id } }, order_by: { updated_at: desc }) {
            id name description created_at updated_at
            workflow_steps { id type }
            workflow_runs(order_by: { started_at: desc }, limit: 1) {
              id status
            }
          }
        }
      `, { org_id: org!.orgId })

      const wfs = data.workflows.map((w: any) => ({
        ...w,
        step_count: w.workflow_steps?.length || 0,
        latest_status: w.workflow_runs?.[0]?.status || null,
      }))
      setWorkflows(wfs)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (orgLoading || loading) {
    return <Layout><div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-gray-500)' }}>Loading workflows...</div></Layout>
  }

  const canEdit = org?.role === 'owner' || org?.role === 'editor'

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '700' }}>Workflows</h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-gray-500)' }}>
            {workflows.length} workflow{workflows.length !== 1 ? 's' : ''} in {org?.orgName}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => router.push('/workflows/new')}
            style={{
              padding: '10px 20px',
              backgroundColor: 'var(--color-primary)',
              color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: '600', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <span style={{ fontSize: '18px' }}>+</span> New Workflow
          </button>
        )}
      </div>

      {workflows.length === 0 ? (
        <div style={{
          padding: '60px 40px', textAlign: 'center',
          backgroundColor: 'white', borderRadius: 'var(--radius)',
          border: '1px solid var(--color-gray-200)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: 'var(--color-gray-700)' }}>No workflows yet</h3>
          <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--color-gray-500)' }}>
            {canEdit ? 'Create your first workflow to get started.' : 'No workflows available in this organization.'}
          </p>
          {canEdit && (
            <button
              onClick={() => router.push('/workflows/new')}
              style={{
                padding: '10px 20px', backgroundColor: 'var(--color-primary)',
                color: 'white', border: 'none', borderRadius: '8px',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              Create Workflow
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {workflows.map(wf => (
            <div
              key={wf.id}
              onClick={() => router.push(`/workflows/${wf.id}`)}
              style={{
                padding: '16px 20px',
                backgroundColor: 'white', borderRadius: 'var(--radius)',
                border: '1px solid var(--color-gray-200)',
                cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s',
                display: 'flex', alignItems: 'center', gap: '16px'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-gray-200)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                backgroundColor: 'var(--color-primary)10',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', flexShrink: 0, background: '#eef2ff'
              }}>⚡</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '600', fontSize: '15px' }}>{wf.name}</span>
                  {wf.latest_status && <Badge status={wf.latest_status} />}
                </div>
                {wf.description && (
                  <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--color-gray-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {wf.description}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--color-gray-400)' }}>
                  <span>{wf.step_count} steps</span>
                  <span>Updated {new Date(wf.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div style={{ color: 'var(--color-gray-300)', fontSize: '20px' }}>›</div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
